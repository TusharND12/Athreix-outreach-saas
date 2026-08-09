import { beforeEach, describe, expect, it, vi } from "vitest";

const firebase = vi.hoisted(() => ({ getAccessToken: vi.fn() }));

vi.mock("@/lib/server/firebase-admin", () => ({
  firebaseAdminApp: {
    options: { credential: { getAccessToken: firebase.getAccessToken } },
  },
}));

vi.mock("@/lib/server/env", () => ({
  env: {
    FIREBASE_PROJECT_ID: "test-project",
    CLOUD_TASKS_LOCATION: "us-central1",
    CLOUD_TASKS_QUEUE: "athreix-search",
    CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL:
      "tasks@test-project.iam.gserviceaccount.com",
    SEARCH_TASK_TARGET_URL: "https://worker.example/tasks/search",
    CLOUD_TASKS_DISPATCH_DEADLINE_SECONDS: 900,
    SEARCH_TASK_SIGNING_SECRET:
      "unit-test-task-signing-secret-at-least-32-characters",
    cloudTasksReady: true,
  },
}));

import {
  enqueueSearch,
  queueReconciliationIsAccepted,
  serializeSearchTask,
  shouldRunSearchInline,
  signSearchTaskBody,
  verifySearchTaskSignature,
} from "@/server/job-queue";

describe("Cloud Tasks search dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebase.getAccessToken.mockResolvedValue({
      access_token: "test-google-access-token",
      expires_in: 3_600,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );
  });

  it("signs the exact minimal task payload", () => {
    const body = serializeSearchTask({ searchId: "search-1", jobId: "job-1" });
    const signature = signSearchTaskBody(body);
    expect(body).toBe('{"searchId":"search-1","jobId":"job-1"}');
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(verifySearchTaskSignature(body, signature ?? "")).toBe(true);
    expect(verifySearchTaskSignature(`${body} `, signature ?? "")).toBe(false);
  });

  it("enqueues an authenticated private HTTP task", async () => {
    await expect(
      enqueueSearch({ searchId: "search-1", jobId: "job-1" }),
    ).resolves.toBe(true);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(url).toBe(
      "https://cloudtasks.googleapis.com/v2/projects/test-project/locations/us-central1/queues/athreix-search/tasks",
    );
    expect(init?.headers).toMatchObject({
      authorization: "Bearer test-google-access-token",
      "content-type": "application/json",
    });
    const request = JSON.parse(String(init?.body)) as {
      task: {
        name: string;
        dispatchDeadline: string;
        httpRequest: {
          body: string;
          url: string;
          oidcToken: { serviceAccountEmail: string; audience: string };
        };
      };
    };
    expect(request.task.name).toMatch(/\/tasks\/search-[a-f0-9]{64}$/);
    expect(request.task.dispatchDeadline).toBe("900s");
    expect(request.task.httpRequest.url).toBe(
      "https://worker.example/tasks/search",
    );
    expect(request.task.httpRequest.oidcToken).toEqual({
      serviceAccountEmail: "tasks@test-project.iam.gserviceaccount.com",
      audience: "https://worker.example",
    });
    expect(
      Buffer.from(request.task.httpRequest.body, "base64").toString("utf8"),
    ).toBe('{"searchId":"search-1","jobId":"job-1"}');
  });

  it("treats a duplicate deterministic task as accepted", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 409 }));
    await expect(
      enqueueSearch({ searchId: "search-1", jobId: "job-1" }),
    ).resolves.toBe(true);
  });

  it.each(["CLAIMED", "UNCERTAIN"] as const)(
    "treats %s reconciliation as accepted without production inline work",
    (state) => {
      expect(queueReconciliationIsAccepted(state)).toBe(true);
      expect(shouldRunSearchInline(false, "production")).toBe(false);
    },
  );

  it("keeps inline fallback available only outside production", () => {
    expect(shouldRunSearchInline(false, "development")).toBe(true);
    expect(shouldRunSearchInline(true, "development")).toBe(false);
  });
});
