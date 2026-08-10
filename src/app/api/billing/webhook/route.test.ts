import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  unmarshal: vi.fn(),
  normalizePaddleEvent: vi.fn(),
  applyBillingEvent: vi.fn(),
}));
const paddleClientToken = `test_${"a".repeat(27)}`;
const paddlePriceStarter = `pri_${"a".repeat(26)}`;
const paddlePriceGrowth = `pri_${"b".repeat(26)}`;
const paddlePriceScale = `pri_${"c".repeat(26)}`;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/paddle", () => ({
  getPaddle: () => ({
    webhooks: { unmarshal: mocks.unmarshal },
  }),
}));
vi.mock("@/server/billing-service", () => ({
  normalizePaddleEvent: mocks.normalizePaddleEvent,
  applyBillingEvent: mocks.applyBillingEvent,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

function configureBilling() {
  vi.stubEnv("BILLING_PROVIDER", "paddle");
  vi.stubEnv("PADDLE_API_KEY", "pdl_sdbx_apikey_test-not-a-secret-value");
  vi.stubEnv("PADDLE_WEBHOOK_SECRET", "pdl_ntfset_test-not-a-secret-value");
  vi.stubEnv("NEXT_PUBLIC_PADDLE_ENV", "sandbox");
  vi.stubEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", paddleClientToken);
  vi.stubEnv("PADDLE_PRICE_STARTER", paddlePriceStarter);
  vi.stubEnv("PADDLE_PRICE_GROWTH", paddlePriceGrowth);
  vi.stubEnv("PADDLE_PRICE_SCALE", paddlePriceScale);
}

describe("billing webhook boundary", () => {
  it("verifies the exact raw body before normalizing an event", async () => {
    configureBilling();
    const raw =
      '{ "event_id": "evt_a",  "event_type": "transaction.completed" }';
    const paddleEvent = {
      eventId: "evt_a",
      eventType: "transaction.completed",
    };
    const normalized = { externalEventId: "evt_a" };
    mocks.unmarshal.mockResolvedValue(paddleEvent);
    mocks.normalizePaddleEvent.mockReturnValue(normalized);
    mocks.applyBillingEvent.mockResolvedValue({
      replayed: false,
      outcome: "PROCESSED",
      creditsGranted: 250,
    });
    const { POST } = await import("@/app/api/billing/webhook/route");

    const response = await POST(
      new Request("https://outreach.athreix.com/api/billing/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "paddle-signature": "ts=123;h1=signature",
        },
        body: raw,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.unmarshal).toHaveBeenCalledWith(
      raw,
      "pdl_ntfset_test-not-a-secret-value",
      "ts=123;h1=signature",
    );
    expect(mocks.normalizePaddleEvent).toHaveBeenCalledWith(paddleEvent, raw);
    expect(mocks.applyBillingEvent).toHaveBeenCalledWith(normalized);
  });

  it("rejects an invalid signature before event processing", async () => {
    configureBilling();
    mocks.unmarshal.mockRejectedValue(new Error("signature mismatch"));
    const { POST } = await import("@/app/api/billing/webhook/route");

    const response = await POST(
      new Request("https://outreach.athreix.com/api/billing/webhook", {
        method: "POST",
        headers: { "paddle-signature": "invalid" },
        body: "{}",
      }),
    );
    const payload = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("BILLING_SIGNATURE_INVALID");
    expect(mocks.normalizePaddleEvent).not.toHaveBeenCalled();
    expect(mocks.applyBillingEvent).not.toHaveBeenCalled();
  });
});
