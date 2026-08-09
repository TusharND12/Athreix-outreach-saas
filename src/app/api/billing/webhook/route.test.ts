import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  normalizeStripeEvent: vi.fn(),
  applyBillingEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mocks.constructEvent },
  }),
}));
vi.mock("@/server/billing-service", () => ({
  normalizeStripeEvent: mocks.normalizeStripeEvent,
  applyBillingEvent: mocks.applyBillingEvent,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

function configureBilling() {
  vi.stubEnv("BILLING_PROVIDER", "stripe");
  vi.stubEnv("BILLING_TAX_MODE", "manual");
  vi.stubEnv("STRIPE_SECRET_KEY", "stripe-secret-test-value");
  vi.stubEnv(
    "STRIPE_WEBHOOK_SECRET",
    ["whsec", "test-not-a-secret-value"].join("_"),
  );
  vi.stubEnv("STRIPE_PRICE_STARTER", "price_starter");
  vi.stubEnv("STRIPE_PRICE_GROWTH", "price_growth");
  vi.stubEnv("STRIPE_PRICE_SCALE", "price_scale");
}

describe("billing webhook boundary", () => {
  it("verifies the exact raw body before normalizing an event", async () => {
    configureBilling();
    const raw = '{ "id": "evt_a",  "type": "invoice.paid" }';
    const stripeEvent = { id: "evt_a", type: "invoice.paid" };
    const normalized = { externalEventId: "evt_a" };
    mocks.constructEvent.mockReturnValue(stripeEvent);
    mocks.normalizeStripeEvent.mockResolvedValue(normalized);
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
          "stripe-signature": "t=123,v1=signature",
        },
        body: raw,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.constructEvent).toHaveBeenCalledWith(
      raw,
      "t=123,v1=signature",
      ["whsec", "test-not-a-secret-value"].join("_"),
    );
    expect(mocks.normalizeStripeEvent).toHaveBeenCalledWith(
      stripeEvent,
      raw,
      expect.any(Object),
    );
    expect(mocks.applyBillingEvent).toHaveBeenCalledWith(normalized);
  });

  it("rejects an invalid signature before event processing", async () => {
    configureBilling();
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("signature mismatch");
    });
    const { POST } = await import("@/app/api/billing/webhook/route");

    const response = await POST(
      new Request("https://outreach.athreix.com/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": "invalid" },
        body: "{}",
      }),
    );
    const payload = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("BILLING_SIGNATURE_INVALID");
    expect(mocks.normalizeStripeEvent).not.toHaveBeenCalled();
    expect(mocks.applyBillingEvent).not.toHaveBeenCalled();
  });
});
