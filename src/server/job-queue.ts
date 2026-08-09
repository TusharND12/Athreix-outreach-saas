import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/server/env";
import { firebaseAdminApp } from "@/lib/server/firebase-admin";

export type SearchQueuePayload = { searchId: string; jobId: string };
export type QueueReconciliation =
  "REMOVED" | "ABSENT" | "CLAIMED" | "UNCERTAIN";

export class QueueEnqueueUncertainError extends Error {
  constructor() {
    super("Cloud Tasks enqueue timed out with an uncertain outcome");
    this.name = "QueueEnqueueUncertainError";
  }
}

function queuePath() {
  if (!env.FIREBASE_PROJECT_ID) return null;
  return `projects/${env.FIREBASE_PROJECT_ID}/locations/${env.CLOUD_TASKS_LOCATION}/queues/${env.CLOUD_TASKS_QUEUE}`;
}

function taskId(jobId: string) {
  return `search-${createHash("sha256").update(jobId).digest("hex")}`;
}

function taskName(jobId: string) {
  const queue = queuePath();
  return queue ? `${queue}/tasks/${taskId(jobId)}` : null;
}

async function authorizationHeader() {
  const credential = firebaseAdminApp.options.credential;
  if (!credential) throw new Error("Firebase Admin credential is unavailable");
  const token = await credential.getAccessToken();
  if (!token.access_token)
    throw new Error("Google access token is unavailable");
  return `Bearer ${token.access_token}`;
}

async function cloudTasksRequest(
  resource: string,
  init: RequestInit = {},
  timeoutMs = 4_000,
) {
  const authorization = await authorizationHeader();
  return fetch(`https://cloudtasks.googleapis.com/v2/${resource}`, {
    ...init,
    headers: {
      authorization,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export function serializeSearchTask(payload: SearchQueuePayload) {
  return JSON.stringify(payload);
}

export function signSearchTaskBody(body: string) {
  if (!env.SEARCH_TASK_SIGNING_SECRET) return null;
  return createHmac("sha256", env.SEARCH_TASK_SIGNING_SECRET)
    .update(body)
    .digest("hex");
}

export function verifySearchTaskSignature(body: string, signature: string) {
  const expected = signSearchTaskBody(body);
  if (!expected || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const left = Buffer.from(signature.toLowerCase(), "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function enqueueSearch(payload: SearchQueuePayload) {
  if (!env.cloudTasksReady) return false;
  const parent = queuePath();
  const name = taskName(payload.jobId);
  const body = serializeSearchTask(payload);
  const signature = signSearchTaskBody(body);
  if (!parent || !name || !signature || !env.SEARCH_TASK_TARGET_URL) {
    return false;
  }
  try {
    const response = await cloudTasksRequest(`${parent}/tasks`, {
      method: "POST",
      body: JSON.stringify({
        task: {
          name,
          dispatchDeadline: `${env.CLOUD_TASKS_DISPATCH_DEADLINE_SECONDS}s`,
          httpRequest: {
            httpMethod: "POST",
            url: env.SEARCH_TASK_TARGET_URL,
            headers: {
              "content-type": "application/json",
              "x-athreix-task-signature": signature,
            },
            body: Buffer.from(body).toString("base64"),
            oidcToken: {
              serviceAccountEmail: env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL,
              audience: new URL(env.SEARCH_TASK_TARGET_URL).origin,
            },
          },
        },
      }),
    });
    if (response.ok || response.status === 409) return true;
    if ([400, 401, 403, 404, 412].includes(response.status)) return false;
    throw new QueueEnqueueUncertainError();
  } catch (error) {
    if (error instanceof QueueEnqueueUncertainError) throw error;
    throw new QueueEnqueueUncertainError();
  }
}

export function queueReconciliationIsAccepted(state: QueueReconciliation) {
  return state === "CLAIMED" || state === "UNCERTAIN";
}

export function shouldRunSearchInline(queued: boolean, nodeEnv: string) {
  return !queued && nodeEnv !== "production";
}

export async function removeUnclaimedSearchJob(
  jobId: string,
): Promise<QueueReconciliation> {
  if (!env.cloudTasksReady) return "ABSENT";
  const name = taskName(jobId);
  if (!name) return "ABSENT";
  try {
    const existing = await cloudTasksRequest(name);
    if (existing.status === 404) return "ABSENT";
    if (!existing.ok) return "UNCERTAIN";
    const removed = await cloudTasksRequest(name, { method: "DELETE" });
    if (removed.ok) return "REMOVED";
    return removed.status === 404 ? "ABSENT" : "UNCERTAIN";
  } catch {
    return "UNCERTAIN";
  }
}

export async function cancelQueuedSearchJob(jobId: string) {
  if (!env.cloudTasksReady) return false;
  const name = taskName(jobId);
  if (!name) return false;
  try {
    const response = await cloudTasksRequest(name, { method: "DELETE" });
    // A missing task may already be executing. The caller must not delete the
    // database job until it can prove that Cloud Tasks cancelled delivery.
    return response.ok;
  } catch {
    return false;
  }
}

export async function queueIsReachable() {
  if (!env.cloudTasksReady) return false;
  const name = queuePath();
  if (!name) return false;
  try {
    const response = await cloudTasksRequest(name, {}, 5_000);
    if (!response.ok) {
      console.error("Cloud Tasks readiness probe failed", response.status);
      return false;
    }
    const queue = (await response.json()) as { state?: unknown };
    return queue.state === "RUNNING";
  } catch (error) {
    console.error(
      "Cloud Tasks readiness probe could not complete",
      error instanceof Error ? error.name : "UnknownError",
    );
    return false;
  }
}
