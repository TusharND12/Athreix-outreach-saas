import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RateLimitDocument = {
  count: number;
  resetAt: number;
  expiresAt: Date;
  updatedAt: Date;
};

const mocks = vi.hoisted(() => ({
  document: undefined as RateLimitDocument | undefined,
  runTransaction: vi.fn(),
  doc: vi.fn(() => ({ id: "rate-limit-document" })),
}));

vi.mock("@/lib/server/firebase-admin", () => ({
  firebaseDb: {
    collection: () => ({ doc: mocks.doc }),
    runTransaction: mocks.runTransaction,
  },
}));

beforeEach(() => {
  mocks.document = undefined;
  mocks.runTransaction.mockImplementation(
    async (
      callback: (transaction: {
        get: () => Promise<{
          exists: boolean;
          data: () => RateLimitDocument | undefined;
        }>;
        set: (_reference: unknown, data: RateLimitDocument) => void;
      }) => Promise<unknown>,
    ) => {
      let nextDocument: RateLimitDocument | undefined;
      const result = await callback({
        get: async () => ({
          exists: Boolean(mocks.document),
          data: () => mocks.document,
        }),
        set: (_reference, data) => {
          nextDocument = data;
        },
      });
      if (nextDocument) mocks.document = nextDocument;
      return result;
    },
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("distributed rate-limit requirement", () => {
  it("uses an atomic Firestore bucket in production", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("FIREBASE_PROJECT_ID", "athreix-outreach-saas");
    const { enforceRateLimit } = await import("@/lib/server/rate-limit");
    await expect(
      enforceRateLimit("production-mutation", 1, 60),
    ).resolves.toMatchObject({
      remaining: 0,
    });
    await expect(
      enforceRateLimit("production-mutation", 1, 60),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
    });
  });

  it("still fails closed when every shared backend is unavailable", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("FIREBASE_PROJECT_ID", "athreix-outreach-saas");
    mocks.runTransaction.mockRejectedValueOnce(new Error("Firestore down"));
    const { enforceRateLimit } = await import("@/lib/server/rate-limit");

    await expect(
      enforceRateLimit("production-mutation", 1, 60),
    ).rejects.toMatchObject({
      code: "RATE_LIMIT_UNAVAILABLE",
      status: 503,
    });
  });

  it("uses the bounded in-memory fallback in test mode", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    const { enforceRateLimit } = await import("@/lib/server/rate-limit");
    await expect(
      enforceRateLimit("test-mutation", 1, 60),
    ).resolves.toMatchObject({
      remaining: 0,
    });
    await expect(
      enforceRateLimit("test-mutation", 1, 60),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
    });
  });
});
