import type { PrismaClient } from "@prisma/client";
import type { EventEntity } from "@paddle/paddle-node-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
  getPaddle: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    subscription: { findFirst: mocks.subscriptionFindFirst },
  },
}));
vi.mock("@/lib/server/paddle", () => ({ getPaddle: mocks.getPaddle }));

const paddleClientToken = `test_${"a".repeat(27)}`;
const paddlePriceStarter = `pri_${"a".repeat(26)}`;
const paddlePriceGrowth = `pri_${"b".repeat(26)}`;
const paddlePriceScale = `pri_${"c".repeat(26)}`;

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

function paidGrowthEvent() {
  return {
    provider: "paddle" as const,
    externalEventId: "evt_paid_growth",
    type: "transaction.completed",
    payloadDigest: "a".repeat(64),
    providerCreatedAt: new Date("2026-08-02T08:00:00.000Z"),
    handled: true,
    workspaceId: "workspace-a",
    externalCustomerId: "cus_a",
    externalSubscriptionId: "sub_a",
    externalInvoiceId: "txn_a",
    priceId: paddlePriceGrowth,
    providerStatus: "active",
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    grantMonthlyCredits: true,
    billingReason: "subscription_recurring",
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
          idempotencyKey: "paddle:transaction:txn_a:monthly-grant",
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

  it("does not treat subscription-update transactions as monthly grants", async () => {
    configureBilling();
    const { monthlyEntitlementIsAllowed } =
      await import("@/server/billing-service");
    const base = {
      externalInvoiceId: "txn_a",
      subscriptionStatus: "ACTIVE" as const,
      currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    };
    expect(
      monthlyEntitlementIsAllowed({
        ...base,
        billingReason: "subscription_recurring",
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

describe("Paddle event normalization", () => {
  it("maps completed web checkout metadata into a monthly entitlement event", async () => {
    configureBilling();
    const { normalizePaddleEvent } = await import("@/server/billing-service");
    const normalized = normalizePaddleEvent(
      {
        eventId: "evt_checkout",
        eventType: "transaction.completed",
        occurredAt: "2026-08-02T08:00:00.000Z",
        data: {
          id: "txn_checkout",
          status: "completed",
          customerId: "ctm_a",
          subscriptionId: "sub_a",
          customData: { athreix_workspace_id: "workspace-a" },
          origin: "web",
          billingPeriod: {
            startsAt: "2026-08-01T00:00:00.000Z",
            endsAt: "2026-09-01T00:00:00.000Z",
          },
          items: [
            {
              quantity: 1,
              price: {
                id: paddlePriceGrowth,
                billingCycle: { interval: "month", frequency: 1 },
              },
            },
          ],
        },
      } as unknown as EventEntity,
      '{"event_id":"evt_checkout"}',
    );

    expect(normalized).toMatchObject({
      provider: "paddle",
      externalEventId: "evt_checkout",
      workspaceId: "workspace-a",
      externalCustomerId: "ctm_a",
      externalSubscriptionId: "sub_a",
      externalInvoiceId: "txn_checkout",
      priceId: paddlePriceGrowth,
      providerStatus: "active",
      grantMonthlyCredits: true,
      billingReason: "web",
    });
  });

  it("maps scheduled cancellation without revoking active access early", async () => {
    configureBilling();
    const { normalizePaddleEvent } = await import("@/server/billing-service");
    const normalized = normalizePaddleEvent(
      {
        eventId: "evt_cancel_scheduled",
        eventType: "subscription.updated",
        occurredAt: "2026-08-03T08:00:00.000Z",
        data: {
          id: "sub_a",
          status: "active",
          customerId: "ctm_a",
          customData: { athreix_workspace_id: "workspace-a" },
          currentBillingPeriod: {
            startsAt: "2026-08-01T00:00:00.000Z",
            endsAt: "2026-09-01T00:00:00.000Z",
          },
          scheduledChange: {
            action: "cancel",
            effectiveAt: "2026-09-01T00:00:00.000Z",
          },
          items: [
            {
              quantity: 1,
              recurring: true,
              price: { id: paddlePriceGrowth },
            },
          ],
        },
      } as unknown as EventEntity,
      '{"event_id":"evt_cancel_scheduled"}',
    );

    expect(normalized).toMatchObject({
      providerStatus: "active",
      cancelAtPeriodEnd: true,
    });
    expect(normalized.grantMonthlyCredits).toBeUndefined();
  });
});

describe("Paddle billing actions", () => {
  it("authorizes checkout with only the configured Price and workspace metadata", async () => {
    configureBilling();
    mocks.userFindUnique.mockResolvedValue({ email: "owner@example.com" });
    mocks.subscriptionFindFirst.mockResolvedValue({
      externalCustomerId: null,
      externalSubscriptionId: null,
      status: "TRIALING",
    });
    const { createCheckout } = await import("@/server/billing-service");

    await expect(
      createCheckout({
        workspaceId: "workspace-a",
        userId: "user-a",
        plan: "GROWTH",
        idempotencyKey: "request-123",
      }),
    ).resolves.toMatchObject({
      sessionId: expect.stringMatching(/^paddle_checkout_[a-f\d]{24}$/),
      priceId: paddlePriceGrowth,
      customer: { email: "owner@example.com" },
      customData: {
        athreix_workspace_id: "workspace-a",
        athreix_plan: "GROWTH",
      },
    });
  });

  it("does not authorize another checkout for an existing managed subscription", async () => {
    configureBilling();
    mocks.userFindUnique.mockResolvedValue({ email: "owner@example.com" });
    mocks.subscriptionFindFirst.mockResolvedValue({
      externalCustomerId: "ctm_existing",
      externalSubscriptionId: "sub_existing",
      status: "ACTIVE",
    });
    const { createCheckout } = await import("@/server/billing-service");

    await expect(
      createCheckout({
        workspaceId: "workspace-a",
        userId: "user-a",
        plan: "STARTER",
        idempotencyKey: "request-123",
      }),
    ).rejects.toMatchObject({ code: "SUBSCRIPTION_EXISTS", status: 409 });
  });

  it("creates a short-lived Paddle portal session for the mapped customer", async () => {
    configureBilling();
    mocks.subscriptionFindFirst.mockResolvedValue({
      externalCustomerId: "ctm_existing",
      externalSubscriptionId: "sub_existing",
      status: "ACTIVE",
    });
    const create = vi.fn().mockResolvedValue({
      urls: {
        general: { overview: "https://customer-portal.paddle.com/test" },
      },
    });
    mocks.getPaddle.mockReturnValue({
      customerPortalSessions: { create },
    });
    const { createCustomerPortal } = await import("@/server/billing-service");

    await expect(createCustomerPortal("workspace-a")).resolves.toEqual({
      url: "https://customer-portal.paddle.com/test",
    });
    expect(create).toHaveBeenCalledWith("ctm_existing", ["sub_existing"]);
  });

  it("schedules cancellation at the next billing period", async () => {
    configureBilling();
    mocks.subscriptionFindFirst.mockResolvedValue({
      externalCustomerId: "ctm_existing",
      externalSubscriptionId: "sub_existing",
      status: "ACTIVE",
    });
    const cancel = vi.fn().mockResolvedValue({
      id: "sub_existing",
      status: "active",
      scheduledChange: { effectiveAt: "2026-09-01T00:00:00.000Z" },
    });
    mocks.getPaddle.mockReturnValue({ subscriptions: { cancel } });
    const { cancelSubscription } = await import("@/server/billing-service");

    await expect(cancelSubscription("workspace-a")).resolves.toEqual({
      subscriptionId: "sub_existing",
      status: "active",
      scheduledChange: "2026-09-01T00:00:00.000Z",
    });
    expect(cancel).toHaveBeenCalledWith("sub_existing", {
      effectiveFrom: "next_billing_period",
    });
  });
});
