import { z } from "zod";
import { env } from "@/lib/server/env";
import { verifySearchTaskSignature } from "@/server/job-queue";
import { processSearchJob } from "@/server/pipeline";

const searchTaskSchema = z
  .object({
    searchId: z.string().min(1).max(200),
    jobId: z.string().min(1).max(200),
  })
  .strict();

export class SearchTaskRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SearchTaskRequestError";
  }
}

function retryAttempt(value: string | undefined) {
  const retryCount = Number.parseInt(value ?? "0", 10);
  return Number.isInteger(retryCount) && retryCount >= 0 ? retryCount + 1 : 1;
}

export async function executeSearchTask(input: {
  body: string;
  signature: string;
  retryCount?: string;
}) {
  if (!verifySearchTaskSignature(input.body, input.signature)) {
    throw new SearchTaskRequestError("Invalid task signature", 401);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(input.body);
  } catch {
    throw new SearchTaskRequestError("Invalid JSON body", 400);
  }
  const parsed = searchTaskSchema.safeParse(payload);
  if (!parsed.success) {
    throw new SearchTaskRequestError("Invalid search task payload", 400);
  }
  await processSearchJob({
    ...parsed.data,
    attempt: retryAttempt(input.retryCount),
    maxAttempts: env.CLOUD_TASKS_MAX_ATTEMPTS,
  });
  return parsed.data;
}
