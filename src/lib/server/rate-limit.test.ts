import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("distributed rate-limit requirement", () => {
  it("fails closed in configured production when Redis is absent", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("REDIS_URL", "");
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
    vi.stubEnv("REDIS_URL", "");
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
