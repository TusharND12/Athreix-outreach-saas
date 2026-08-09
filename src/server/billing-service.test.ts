import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/db", () => ({ db: {} }));
vi.mock("@/lib/server/stripe", () => ({ getStripe: vi.fn() }));

afterEach(() => {
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

function paidGrowthEvent() {
  return {
    provider: "stripe" as const,
    externalEventId: "evt_paid_growth",
    type: "invoice.paid",
    payloadDigest: "a".repeat(64),
    providerCreatedAt: new Date("2026-08-02T08:00:00.000Z"),
    handled: true,
    workspaceId: "workspace-a",
    externalCustomerId: "cus_a",
    externalSubscriptionId: "sub_a",
    externalInvoiceId: "in_a",
    priceId: "price_growth",
    providerStatus: "active",
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    grantMonthlyCredits: true,
    billingReason: "subscription_cycle",
  };
}

describe("billing event entitlement safety", () => {
  it("grants configured credits once in the event transaction", async () => {
    configureBilling();
    const billingEventCreate = vi.fn().mockResolvedValue({});
    const subscriptionUpdate = vi.fn().mockResolvedValue({});
    const workspaceUpdate = vi
      .fn()
      .mockResolvedValueOnce({ id: "workspace-a" })
      .mockResolvedValueOnce({ creditBalance: 740 });
    const creditCreate = vi.fn().mockResolvedValue({});
    const tx = {
      billingEvent: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: billingEventCreate,
      },
      subscription: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue({
          id: "local-subscription",
          workspaceId: "workspace-a",
          externalSubscriptionId: null,
          status: "TRIALING",
          lastProviderEventAt: null,
        }),
        update: subscriptionUpdate,
        create: vi.fn(),
      },
      workspace: {
        findUnique: vi.fn().mockResolvedValue({ id: "workspace-a" }),
        update: workspaceUpdate,
      },
      creditLedger: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: creditCreate,
      },
    };
    const database = {
      billingEvent: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaClient;

    const { applyBillingEvent } = await import("@/server/billing-service");
    const result = await applyBillingEvent(paidGrowthEvent(), database);

    expect(result).toMatchObject({
      replayed: false,
      outcome: "PROCESSED",
      workspaceId: "workspace-a",
      creditsGranted: 500,
    });
    expect(workspaceUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "workspace-a" },
        data: { creditBalance: { increment: 500 } },
      }),
    );
    expect(creditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 500,
          balanceAfter: 740,
          idempotencyKey:
            "stripe:subscription:sub_a:period:2026-08-01T00:00:00.000Z:monthly-grant",
        }),
      }),
    );
    expect(subscriptionUpdate).toHaveBeenCalledTimes(1);
    expect(billingEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: "PROCESSED" }),
      }),
    );
  });

  it("returns a recorded event replay without touching entitlement state", async () => {
    configureBilling();
    const transaction = vi.fn();
    const database = {
      billingEvent: {
        findUnique: vi.fn().mockResolvedValue({
          payloadDigest: "a".repeat(64),
          workspaceId: "workspace-a",
          outcome: "PROCESSED",
        }),
      },
      $transaction: transaction,
    } as unknown as PrismaClient;

    const { applyBillingEvent } = await import("@/server/billing-service");
    await expect(
      applyBillingEvent(paidGrowthEvent(), database),
    ).resolves.toMatchObject({
      replayed: true,
      creditsGranted: 0,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a reused provider event ID with different signed content", async () => {
    configureBilling();
    const database = {
      billingEvent: {
        findUnique: vi.fn().mockResolvedValue({
          payloadDigest: "b".repeat(64),
          workspaceId: "workspace-a",
          outcome: "PROCESSED",
        }),
      },
    } as unknown as PrismaClient;

    const { applyBillingEvent } = await import("@/server/billing-service");
    await expect(
      applyBillingEvent(paidGrowthEvent(), database),
    ).rejects.toMatchObject({ code: "BILLING_EVENT_CONFLICT", status: 409 });
  });

  it("rejects a signed event that conflicts with an existing tenant mapping", async () => {
    configureBilling();
    const tx = {
      billingEvent: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      subscription: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ workspaceId: "workspace-b" })
          .mockResolvedValueOnce(null),
      },
    };
    const database = {
      billingEvent: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaClient;

    const { applyBillingEvent } = await import("@/server/billing-service");
    await expect(
      applyBillingEvent(paidGrowthEvent(), database),
    ).rejects.toMatchObject({ code: "BILLING_TENANT_CONFLICT" });
    expect(tx.billingEvent.create).not.toHaveBeenCalled();
  });
});

describe("subscription status mapping", () => {
  it("fails closed for unknown provider states", async () => {
    configureBilling();
    const { mapSubscriptionStatus } = await import("@/server/billing-service");
    expect(mapSubscriptionStatus("active")).toBe("ACTIVE");
    expect(mapSubscriptionStatus("past_due")).toBe("PAST_DUE");
    expect(mapSubscriptionStatus("future_state")).toBeUndefined();
  });

  it("does not treat proration or plan-update invoices as monthly grants", async () => {
    configureBilling();
    const { monthlyEntitlementIsAllowed } =
      await import("@/server/billing-service");
    const base = {
      externalInvoiceId: "in_a",
      subscriptionStatus: "ACTIVE" as const,
      currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    };
    expect(
      monthlyEntitlementIsAllowed({
        ...base,
        billingReason: "subscription_cycle",
      }),
    ).toBe(true);
    expect(
      monthlyEntitlementIsAllowed({
        ...base,
        billingReason: "subscription_update",
      }),
    ).toBe(false);
  });
});
