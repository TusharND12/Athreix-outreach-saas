import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function configureReviewedConsumerSource() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APIFY_API_TOKEN", "token");
  vi.stubEnv("APIFY_B2C_ACTOR_ID", "trusted/b2c");
  vi.stubEnv("APIFY_ALLOWED_ACTORS", "trusted/b2c");
  vi.stubEnv("APIFY_TERMS_VERSION", "terms-2026-01");
  vi.stubEnv(
    "APIFY_ACTOR_REVIEWS_JSON",
    JSON.stringify([
      {
        actorId: "trusted/b2c",
        creator: "approved-creator",
        reviewedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
        termsVersion: "terms-2026-01",
        reviewVersion: "review-1",
        modes: ["B2C"],
        jurisdictions: ["India"],
        permissions: ["permissioned_consumer_data"],
        maxMemoryMbytes: 512,
        timeoutSecs: 120,
        maxTotalChargeUsd: 5,
        approved: true,
      },
    ]),
  );
  vi.stubEnv(
    "APIFY_B2C_SOURCES_JSON",
    JSON.stringify([
      {
        reference: "partner:contract-123",
        audienceSource: "PERMISSIONED_PARTNER",
        actorId: "trusted/b2c",
        sourceOwner: "Partner Ltd",
        workspaceIds: ["workspace-a"],
        jurisdictions: ["India"],
        reviewedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
        termsVersion: "terms-2026-01",
        approved: true,
      },
    ]),
  );
}

describe("provider configuration trust gates", () => {
  it("does not auto-allow a configured actor", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APIFY_API_TOKEN", "token");
    vi.stubEnv("APIFY_B2B_ACTOR_ID", "trusted/b2b");
    vi.stubEnv("APIFY_ALLOWED_ACTORS", "");
    vi.stubEnv(
      "APIFY_ACTOR_REVIEWS_JSON",
      JSON.stringify([{ actorId: "trusted/b2b", approved: true }]),
    );
    const { env } = await import("@/lib/server/env");
    expect(env.b2bActorReady).toBe(false);
  });

  it("requires exact allowlist, current review, terms, and source scope", async () => {
    configureReviewedConsumerSource();
    const { env } = await import("@/lib/server/env");
    expect(env.b2cActorReady).toBe(true);
  });

  it("does not authorize a known consumer source for another workspace", async () => {
    configureReviewedConsumerSource();
    const { approvedB2CSource, env } = await import("@/lib/server/env");
    const lookup = (workspaceId: string) =>
      approvedB2CSource(env.approvedB2CSources, {
        reference: "partner:contract-123",
        audienceSource: "PERMISSIONED_PARTNER",
        actorId: "trusted/b2c",
        workspaceId,
        jurisdiction: "India",
        termsVersion: "terms-2026-01",
      });
    expect(lookup("workspace-a")).toBeDefined();
    expect(lookup("workspace-b")).toBeUndefined();
  });
});

describe("search runtime defaults", () => {
  it("maps the high-volume scoring and interactive outreach models correctly", async () => {
    const { env } = await import("@/lib/server/env");
    expect(env.OPENROUTER_SCORING_MODEL).toBe("openrouter/auto");
    expect(env.OPENROUTER_OUTREACH_MODEL).toBe("openrouter/auto");
  });

  it("keeps the stale lease window at least three heartbeats wide", async () => {
    vi.stubEnv("SEARCH_JOB_HEARTBEAT_INTERVAL_MS", "20000");
    vi.stubEnv("SEARCH_JOB_STALE_AFTER_MS", "30000");
    const { env } = await import("@/lib/server/env");
    expect(env.SEARCH_JOB_STALE_AFTER_MS).toBeGreaterThanOrEqual(
      env.SEARCH_JOB_HEARTBEAT_INTERVAL_MS * 3,
    );
  });
});
