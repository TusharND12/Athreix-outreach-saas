import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/lib/server/env";

export type SearchQueuePayload = { searchId: string; jobId: string };
export type QueueReconciliation =
  "REMOVED" | "ABSENT" | "CLAIMED" | "UNCERTAIN";

export class QueueEnqueueUncertainError extends Error {
  constructor() {
    super("Queue enqueue timed out with an uncertain outcome");
    this.name = "QueueEnqueueUncertainError";
  }
}

let connection: IORedis | null = null;
let producer: IORedis | null = null;
let queue: Queue<SearchQueuePayload> | null = null;
const workerHeartbeatKey = "athreix:worker:search:heartbeat";
const workerHeartbeatTtlSeconds = 30;

export function queueConnection() {
  if (!env.REDIS_URL) return null;
  connection ??= new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  });
  return connection;
}

function producerConnection() {
  if (!env.REDIS_URL) return null;
  producer ??= new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    enableOfflineQueue: false,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  return producer;
}

export function searchQueue() {
  const redis = producerConnection();
  if (!redis) return null;
  queue ??= new Queue<SearchQueuePayload>("athreix-prospect-search", {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 250,
      removeOnFail: 500,
    },
  });
  return queue;
}

export async function enqueueSearch(payload: SearchQueuePayload) {
  const target = searchQueue();
  if (!target) return false;
  const redis = producerConnection();
  if (redis?.status === "wait") await redis.connect();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      target.add("process-search", payload, { jobId: payload.jobId }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new QueueEnqueueUncertainError()),
          4_000,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  return true;
}

export function queueStateIsClaimed(state: string) {
  return ["active", "completed", "failed"].includes(state);
}

export function queueReconciliationIsAccepted(state: QueueReconciliation) {
  return state === "CLAIMED" || state === "UNCERTAIN";
}

export function shouldRunSearchInline(queued: boolean, nodeEnv: string) {
  return !queued && nodeEnv !== "production";
}

async function within<T>(promise: Promise<T>, milliseconds: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Queue reconciliation timed out")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Reconcile an ambiguous producer timeout before database state or credit
 * reservations are changed. A job that may have been claimed is deliberately
 * treated as accepted; only a confirmed unclaimed job is removed.
 */
export async function removeUnclaimedSearchJob(
  jobId: string,
): Promise<QueueReconciliation> {
  const target = searchQueue();
  if (!target) return "ABSENT";
  try {
    const job = await within(target.getJob(jobId), 2_000);
    if (!job) return "ABSENT";
    const state = await within(job.getState(), 2_000);
    if (queueStateIsClaimed(state)) return "CLAIMED";
    if (
      !["waiting", "delayed", "prioritized", "waiting-children"].includes(state)
    ) {
      return "UNCERTAIN";
    }
    try {
      await within(job.remove(), 2_000);
      return "REMOVED";
    } catch {
      // Removal loses the race when a worker claims the job. Re-read if
      // possible, but never assume absence when Redis state is uncertain.
      const current = await within(target.getJob(jobId), 2_000);
      if (!current) return "CLAIMED";
      const currentState = await within(current.getState(), 2_000);
      return queueStateIsClaimed(currentState) ? "CLAIMED" : "UNCERTAIN";
    }
  } catch {
    return "UNCERTAIN";
  }
}

export async function queueIsReachable() {
  const redis = producerConnection();
  if (!redis) return false;
  try {
    return await Promise.race([
      redis.ping().then((value) => value === "PONG"),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), 1_500),
      ),
    ]);
  } catch {
    return false;
  }
}

export async function recordWorkerHeartbeat(client?: IORedis | null) {
  const redis = client ?? queueConnection();
  if (!redis) return false;
  try {
    await redis.set(
      workerHeartbeatKey,
      new Date().toISOString(),
      "EX",
      workerHeartbeatTtlSeconds,
    );
    return true;
  } catch {
    return false;
  }
}

export async function workerIsLive() {
  const redis = producerConnection();
  if (!redis) return false;
  try {
    if (redis.status === "wait") await redis.connect();
    return await Promise.race([
      redis.get(workerHeartbeatKey).then((value) => Boolean(value)),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), 1_500),
      ),
    ]);
  } catch {
    return false;
  }
}
