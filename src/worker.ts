import { Worker } from "bullmq";
import {
  queueConnection,
  recordWorkerHeartbeat,
  type SearchQueuePayload,
} from "@/server/job-queue";
import { processSearchJob } from "@/server/pipeline";
import { env } from "@/lib/server/env";

const connection = queueConnection();
if (!connection) {
  console.error("REDIS_URL is required to run the background worker.");
  process.exitCode = 1;
} else {
  const worker = new Worker<SearchQueuePayload>(
    "athreix-prospect-search",
    async (job) =>
      processSearchJob({
        ...job.data,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts ?? 1,
      }),
    {
      connection,
      concurrency: env.SEARCH_WORKER_CONCURRENCY,
      lockDuration: 120_000,
      stalledInterval: 30_000,
      maxStalledCount: 2,
    },
  );
  const heartbeat = () => {
    void recordWorkerHeartbeat(connection).then((recorded) => {
      if (!recorded) console.error("Worker heartbeat could not be recorded.");
    });
  };
  heartbeat();
  const heartbeatTimer = setInterval(heartbeat, 10_000);

  worker.on("completed", (job) =>
    console.info(`Search job ${job.id} completed`),
  );
  worker.on("failed", (job, error) =>
    console.error(`Search job ${job?.id ?? "unknown"} failed`, error.message),
  );
  worker.on("error", (error) =>
    console.error("Search worker infrastructure error", error),
  );

  const shutdown = async () => {
    clearInterval(heartbeatTimer);
    await worker.close();
    await connection.quit();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
