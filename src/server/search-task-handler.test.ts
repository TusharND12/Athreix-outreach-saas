import { beforeEach, describe, expect, it, vi } from "vitest";

const pipeline = vi.hoisted(() => ({ processSearchJob: vi.fn() }));

vi.mock("@/server/pipeline", () => pipeline);
vi.mock("@/lib/server/env", () => ({
  env: {
    SEARCH_TASK_SIGNING_SECRET:
      "unit-test-task-signing-secret-at-least-32-characters",
    CLOUD_TASKS_MAX_ATTEMPTS: 4,
  },
}));

import { signSearchTaskBody } from "@/server/job-queue";
import { executeSearchTask } from "@/server/search-task-handler";

describe("search task HTTP boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipeline.processSearchJob.mockResolvedValue(undefined);
  });

  it("verifies and dispatches a minimal signed payload", async () => {
    const body = '{"searchId":"search-1","jobId":"job-1"}';
    await expect(
      executeSearchTask({
        body,
        signature: signSearchTaskBody(body) ?? "",
        retryCount: "2",
      }),
    ).resolves.toEqual({ searchId: "search-1", jobId: "job-1" });
    expect(pipeline.processSearchJob).toHaveBeenCalledWith({
      searchId: "search-1",
      jobId: "job-1",
      attempt: 3,
      maxAttempts: 4,
    });
  });

  it("rejects an invalid signature before processing", async () => {
    await expect(
      executeSearchTask({
        body: '{"searchId":"search-1","jobId":"job-1"}',
        signature: "invalid",
      }),
    ).rejects.toEqual(expect.objectContaining({ status: 401 }));
    expect(pipeline.processSearchJob).not.toHaveBeenCalled();
  });

  it("rejects additional task fields", async () => {
    const body = '{"searchId":"search-1","jobId":"job-1","contact":"secret"}';
    await expect(
      executeSearchTask({
        body,
        signature: signSearchTaskBody(body) ?? "",
      }),
    ).rejects.toEqual(expect.objectContaining({ status: 400 }));
    expect(pipeline.processSearchJob).not.toHaveBeenCalled();
  });
});
