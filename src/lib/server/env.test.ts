import { afterEach, describe, expect, it, vi } from "vitest";

const paddleClientToken = `test_${"a".repeat(27)}`;
const paddlePriceStarter = `pri_${"a".repeat(26)}`;
const paddlePriceGrowth = `pri_${"b".repeat(26)}`;
const paddlePriceScale = `pri_${"c".repeat(26)}`;

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

  it("marks a jurisdiction-scoped B2B review ready without widening its scope", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APIFY_API_TOKEN", "token");
    vi.stubEnv("APIFY_B2B_ACTOR_ID", "trusted/b2b");
    vi.stubEnv("APIFY_ALLOWED_ACTORS", "trusted/b2b");
    vi.stubEnv("APIFY_TERMS_VERSION", "terms-2026-01");
    vi.stubEnv(
      "APIFY_ACTOR_REVIEWS_JSON",
      JSON.stringify([
        {
          actorId: "trusted/b2b",
          creator: "approved-creator",
          reviewedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2099-01-01T00:00:00.000Z",
          termsVersion: "terms-2026-01",
          reviewVersion: "review-1",
          modes: ["B2B"],
          jurisdictions: ["India"],
          permissions: ["professional_business_data"],
          maxMemoryMbytes: 1024,
          timeoutSecs: 300,
          maxTotalChargeUsd: 5,
          approved: true,
        },
      ]),
    );
    const { actorReviewAllows, env } = await import("@/lib/server/env");
    expect(env.b2bActorReady).toBe(true);
    expect(
      actorReviewAllows(env.actorReviews[0], {
        mode: "B2B",
        jurisdiction: "India",
        termsVersion: "terms-2026-01",
      }),
    ).toBe(true);
    expect(
      actorReviewAllows(env.actorReviews[0], {
        mode: "B2B",
        jurisdiction: "United States",
        termsVersion: "terms-2026-01",
      }),
    ).toBe(false);
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
    expect(env.openRouterModelsPinned).toBe(false);
  });

  it("recognizes an explicitly pinned production model set", async () => {
    vi.stubEnv("OPENROUTER_MODEL", "openai/model-default");
    vi.stubEnv("OPENROUTER_SCORING_MODEL", "openai/model-scoring");
    vi.stubEnv("OPENROUTER_OUTREACH_MODEL", "openai/model-outreach");
    vi.stubEnv("OPENROUTER_RESEARCH_MODEL", "openai/model-research");
    const { env } = await import("@/lib/server/env");
    expect(env.openRouterModelsPinned).toBe(true);
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

describe("production URL safety", () => {
  it("accepts an explicit Auth.js URL matching the public application origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://outreach.athreix.com");
    vi.stubEnv("AUTH_URL", "https://outreach.athreix.com");
    const { env } = await import("@/lib/server/env");
    expect(env.productionAppUrlReady).toBe(true);
    expect(env.productionAuthUrlReady).toBe(true);
  });

  it("rejects an Auth.js URL on a different origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://outreach.athreix.com");
    vi.stubEnv("AUTH_URL", "https://0.0.0.0:8080");
    const { env } = await import("@/lib/server/env");
    expect(env.productionAuthUrlReady).toBe(false);
  });
});

describe("billing readiness", () => {
  it("requires Paddle Sandbox credentials, signed webhook, client token, and every plan price", async () => {
    vi.stubEnv("BILLING_PROVIDER", "paddle");
    vi.stubEnv("PADDLE_API_KEY", "pdl_sdbx_apikey_test-not-a-secret-value");
    vi.stubEnv("PADDLE_WEBHOOK_SECRET", "pdl_ntfset_test-not-a-secret-value");
    vi.stubEnv("NEXT_PUBLIC_PADDLE_ENV", "sandbox");
    vi.stubEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", paddleClientToken);
    vi.stubEnv("PADDLE_PRICE_STARTER", paddlePriceStarter);
    vi.stubEnv("PADDLE_PRICE_GROWTH", paddlePriceGrowth);
    vi.stubEnv("PADDLE_PRICE_SCALE", paddlePriceScale);
    const { env } = await import("@/lib/server/env");
    expect(env.billingReady).toBe(true);
  });

  it("keeps billing fail-closed when webhook verification is missing", async () => {
    vi.stubEnv("BILLING_PROVIDER", "paddle");
    vi.stubEnv("PADDLE_API_KEY", "pdl_sdbx_apikey_test-not-a-secret-value");
    vi.stubEnv("PADDLE_WEBHOOK_SECRET", "");
    vi.stubEnv("NEXT_PUBLIC_PADDLE_ENV", "sandbox");
    vi.stubEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", paddleClientToken);
    vi.stubEnv("PADDLE_PRICE_STARTER", paddlePriceStarter);
    vi.stubEnv("PADDLE_PRICE_GROWTH", paddlePriceGrowth);
    vi.stubEnv("PADDLE_PRICE_SCALE", paddlePriceScale);
    const { env } = await import("@/lib/server/env");
    expect(env.billingReady).toBe(false);
  });

  it("rejects duplicate price IDs that would make plan mapping ambiguous", async () => {
    vi.stubEnv("BILLING_PROVIDER", "paddle");
    vi.stubEnv("PADDLE_API_KEY", "pdl_sdbx_apikey_test-not-a-secret-value");
    vi.stubEnv("PADDLE_WEBHOOK_SECRET", "pdl_ntfset_test-not-a-secret-value");
    vi.stubEnv("NEXT_PUBLIC_PADDLE_ENV", "sandbox");
    vi.stubEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", paddleClientToken);
    vi.stubEnv("PADDLE_PRICE_STARTER", paddlePriceStarter);
    vi.stubEnv("PADDLE_PRICE_GROWTH", paddlePriceStarter);
    vi.stubEnv("PADDLE_PRICE_SCALE", paddlePriceScale);
    const { env } = await import("@/lib/server/env");
    expect(env.billingReady).toBe(false);
  });

  it("rejects a malformed Paddle client token before checkout is enabled", async () => {
    vi.stubEnv("BILLING_PROVIDER", "paddle");
    vi.stubEnv("PADDLE_API_KEY", "pdl_sdbx_apikey_test-not-a-secret-value");
    vi.stubEnv("PADDLE_WEBHOOK_SECRET", "pdl_ntfset_test-not-a-secret-value");
    vi.stubEnv("NEXT_PUBLIC_PADDLE_ENV", "sandbox");
    vi.stubEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", "test_too_short");
    vi.stubEnv("PADDLE_PRICE_STARTER", paddlePriceStarter);
    vi.stubEnv("PADDLE_PRICE_GROWTH", paddlePriceGrowth);
    vi.stubEnv("PADDLE_PRICE_SCALE", paddlePriceScale);
    const { env } = await import("@/lib/server/env");
    expect(env.billingReady).toBe(false);
  });
});
