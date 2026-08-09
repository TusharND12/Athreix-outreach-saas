import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { getStripe } from "@/lib/server/stripe";
import {
  billingPlan,
  billingPlanForPrice,
  type BillablePlan,
} from "@/server/billing-plans";

type InternalSubscriptionStatus =
  "TRIALING" | "ACTIVE" | "PAST_DUE" | "PAUSED" | "CANCELLED";

export type NormalizedBillingEvent = {
  provider: "stripe";
  externalEventId: string;
  type: string;
  payloadDigest: string;
  providerCreatedAt: Date;
  handled: boolean;
  workspaceId?: string;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  externalInvoiceId?: string;
  priceId?: string;
  providerStatus?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  grantMonthlyCredits?: boolean;
  billingReason?: string;
};

function externalId(value: string | { id: string } | null | undefined) {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}

function validWorkspaceMetadata(value: string | undefined) {
  if (!value || value.length > 128 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return undefined;
  }
  return value;
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  return externalId(invoice.parent?.subscription_details?.subscription);
}

function providerEventKey(
  input: Pick<NormalizedBillingEvent, "provider" | "externalEventId">,
) {
  return `${input.provider}:${input.externalEventId}`;
}

function normalizeSubscription(
  base: Pick<
    NormalizedBillingEvent,
    | "provider"
    | "externalEventId"
    | "type"
    | "payloadDigest"
    | "providerCreatedAt"
  >,
  subscription: Stripe.Subscription,
  options?: {
    expectedWorkspaceId?: string;
    externalInvoiceId?: string;
    grantMonthlyCredits?: boolean;
    billingReason?: string;
    periodStart?: Date;
    periodEnd?: Date;
  },
): NormalizedBillingEvent {
  const item = subscription.items.data[0];
  if (!item || subscription.items.data.length !== 1 || item.quantity !== 1) {
    throw new AppError(
      "BILLING_SUBSCRIPTION_SHAPE_INVALID",
      "The subscription does not contain exactly one Athreix plan.",
      500,
    );
  }
  const workspaceId = validWorkspaceMetadata(
    subscription.metadata.athreixWorkspaceId,
  );
  if (
    options?.expectedWorkspaceId &&
    workspaceId !== options.expectedWorkspaceId
  ) {
    throw new AppError(
      "BILLING_WORKSPACE_MISMATCH",
      "The signed billing event does not match its workspace reference.",
      500,
    );
  }
  return {
    ...base,
    handled: true,
    workspaceId,
    externalCustomerId: externalId(subscription.customer),
    externalSubscriptionId: subscription.id,
    externalInvoiceId: options?.externalInvoiceId,
    priceId: item.price.id,
    providerStatus: subscription.status,
    currentPeriodStart:
      options?.periodStart ?? new Date(item.current_period_start * 1_000),
    currentPeriodEnd:
      options?.periodEnd ?? new Date(item.current_period_end * 1_000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    grantMonthlyCredits: options?.grantMonthlyCredits,
    billingReason: options?.billingReason,
  };
}

export async function normalizeStripeEvent(
  event: Stripe.Event,
  rawPayload: string,
  stripe = getStripe(),
): Promise<NormalizedBillingEvent> {
  const base = {
    provider: "stripe" as const,
    externalEventId: event.id,
    type: event.type,
    payloadDigest: createHash("sha256").update(rawPayload).digest("hex"),
    providerCreatedAt: new Date(event.created * 1_000),
  };

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    return normalizeSubscription(base, event.data.object);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const subscriptionId = externalId(session.subscription);
    if (session.mode !== "subscription" || !subscriptionId) {
      throw new AppError(
        "BILLING_CHECKOUT_INVALID",
        "The completed checkout is not an Athreix subscription.",
        500,
      );
    }
    const expectedWorkspaceId = validWorkspaceMetadata(
      session.client_reference_id ?? undefined,
    );
    if (!expectedWorkspaceId) {
      throw new AppError(
        "BILLING_WORKSPACE_UNRESOLVED",
        "The completed checkout is missing its workspace reference.",
        500,
      );
    }
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return normalizeSubscription(base, subscription, { expectedWorkspaceId });
  }

  if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed"
  ) {
    const invoice = event.data.object;
    const subscriptionId = subscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      return { ...base, handled: false };
    }
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionItem = subscription.items.data[0];
    const recurringLine = invoice.lines.data.find(
      (line) =>
        subscriptionItem &&
        line.parent?.type === "subscription_item_details" &&
        line.parent.subscription_item_details?.subscription_item ===
          subscriptionItem.id &&
        !line.parent.subscription_item_details.proration,
    );
    const expectedWorkspaceId = validWorkspaceMetadata(
      invoice.parent?.subscription_details?.metadata?.athreixWorkspaceId as
        string | undefined,
    );
    return normalizeSubscription(base, subscription, {
      expectedWorkspaceId,
      externalInvoiceId: invoice.id,
      billingReason: invoice.billing_reason ?? undefined,
      grantMonthlyCredits:
        event.type === "invoice.paid" &&
        invoice.status === "paid" &&
        ["subscription_create", "subscription_cycle"].includes(
          invoice.billing_reason ?? "",
        ) &&
        Boolean(recurringLine),
      periodStart: recurringLine
        ? new Date(recurringLine.period.start * 1_000)
        : undefined,
      periodEnd: recurringLine
        ? new Date(recurringLine.period.end * 1_000)
        : undefined,
    });
  }

  return { ...base, handled: false };
}

export function mapSubscriptionStatus(
  status?: string,
): InternalSubscriptionStatus | undefined {
  if (status === "trialing") return "TRIALING";
  if (status === "active") return "ACTIVE";
  if (
    ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(
      status ?? "",
    )
  ) {
    return "PAST_DUE";
  }
  if (status === "paused") return "PAUSED";
  if (status === "canceled") return "CANCELLED";
  return undefined;
}

export function monthlyEntitlementIsAllowed(input: {
  externalInvoiceId?: string;
  subscriptionStatus?: InternalSubscriptionStatus;
  billingReason?: string;
  currentPeriodStart?: Date;
}) {
  return Boolean(
    input.externalInvoiceId &&
    input.subscriptionStatus === "ACTIVE" &&
    ["subscription_create", "subscription_cycle"].includes(
      input.billingReason ?? "",
    ) &&
    input.currentPeriodStart,
  );
}

async function replayResult(
  input: NormalizedBillingEvent,
  database: PrismaClient,
) {
  const existing = await database.billingEvent.findUnique({
    where: { providerEventKey: providerEventKey(input) },
    select: { payloadDigest: true, workspaceId: true, outcome: true },
  });
  if (!existing) return undefined;
  if (existing.payloadDigest !== input.payloadDigest) {
    throw new AppError(
      "BILLING_EVENT_CONFLICT",
      "A billing event identifier was reused with different content.",
      409,
    );
  }
  return {
    replayed: true,
    workspaceId: existing.workspaceId,
    outcome: existing.outcome,
    creditsGranted: 0,
  };
}

export async function applyBillingEvent(
  input: NormalizedBillingEvent,
  database: PrismaClient = db,
) {
  const replay = await replayResult(input, database);
  if (replay) return replay;

  try {
    return await database.$transaction(
      async (tx) => {
        const transactionReplay = await tx.billingEvent.findUnique({
          where: { providerEventKey: providerEventKey(input) },
          select: { payloadDigest: true, workspaceId: true, outcome: true },
        });
        if (transactionReplay) {
          if (transactionReplay.payloadDigest !== input.payloadDigest) {
            throw new AppError(
              "BILLING_EVENT_CONFLICT",
              "A billing event identifier was reused with different content.",
              409,
            );
          }
          return {
            replayed: true,
            workspaceId: transactionReplay.workspaceId,
            outcome: transactionReplay.outcome,
            creditsGranted: 0,
          };
        }

        if (!input.handled) {
          await tx.billingEvent.create({
            data: {
              providerEventKey: providerEventKey(input),
              provider: input.provider,
              externalEventId: input.externalEventId,
              type: input.type,
              payloadDigest: input.payloadDigest,
              outcome: "IGNORED",
              providerCreatedAt: input.providerCreatedAt,
            },
          });
          return {
            replayed: false,
            workspaceId: null,
            outcome: "IGNORED" as const,
            creditsGranted: 0,
          };
        }

        const plan = billingPlanForPrice(input.priceId);
        const status = mapSubscriptionStatus(input.providerStatus);
        if (
          !plan ||
          !status ||
          !input.externalCustomerId ||
          !input.externalSubscriptionId
        ) {
          throw new AppError(
            "BILLING_EVENT_UNRECOGNIZED",
            "The billing event references an unknown plan or subscription state.",
            500,
          );
        }

        const [bySubscription, byCustomer] = await Promise.all([
          tx.subscription.findUnique({
            where: { externalSubscriptionId: input.externalSubscriptionId },
          }),
          tx.subscription.findUnique({
            where: { externalCustomerId: input.externalCustomerId },
          }),
        ]);
        const mappedWorkspaceId =
          bySubscription?.workspaceId ?? byCustomer?.workspaceId;
        if (
          bySubscription &&
          byCustomer &&
          bySubscription.workspaceId !== byCustomer.workspaceId
        ) {
          throw new AppError(
            "BILLING_TENANT_CONFLICT",
            "The billing customer and subscription map to different workspaces.",
            500,
          );
        }
        if (
          input.workspaceId &&
          mappedWorkspaceId &&
          input.workspaceId !== mappedWorkspaceId
        ) {
          throw new AppError(
            "BILLING_TENANT_CONFLICT",
            "The billing event cannot be assigned to this workspace.",
            500,
          );
        }
        const workspaceId = input.workspaceId ?? mappedWorkspaceId;
        if (!workspaceId) {
          throw new AppError(
            "BILLING_WORKSPACE_UNRESOLVED",
            "The billing event cannot be linked to a workspace.",
            500,
          );
        }
        const workspace = await tx.workspace.findUnique({
          where: { id: workspaceId },
          select: { id: true },
        });
        if (!workspace) {
          throw new AppError(
            "BILLING_WORKSPACE_UNRESOLVED",
            "The billing workspace no longer exists.",
            500,
          );
        }

        const localSubscription =
          bySubscription ??
          byCustomer ??
          (await tx.subscription.findFirst({
            where: { workspaceId },
            orderBy: { createdAt: "desc" },
          }));
        if (
          localSubscription?.externalSubscriptionId &&
          localSubscription.externalSubscriptionId !==
            input.externalSubscriptionId &&
          localSubscription.status !== "CANCELLED"
        ) {
          throw new AppError(
            "BILLING_SUBSCRIPTION_CONFLICT",
            "This workspace already has another managed subscription.",
            409,
          );
        }

        const stale = Boolean(
          localSubscription?.lastProviderEventAt &&
          localSubscription.lastProviderEventAt > input.providerCreatedAt,
        );
        if (!stale) {
          const data = {
            plan: plan.id,
            status,
            provider: input.provider,
            externalCustomerId: input.externalCustomerId,
            externalSubscriptionId: input.externalSubscriptionId,
            externalPriceId: plan.priceId,
            currentPeriodStart: input.currentPeriodStart,
            currentPeriodEnd: input.currentPeriodEnd,
            cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
            lastProviderEventAt: input.providerCreatedAt,
            lastProviderEventId: input.externalEventId,
          } as const;
          if (localSubscription) {
            await tx.subscription.update({
              where: { id: localSubscription.id },
              data,
            });
          } else {
            await tx.subscription.create({
              data: { workspaceId, ...data },
            });
          }
          await tx.workspace.update({
            where: { id: workspaceId },
            data: { monthlyCreditCap: plan.monthlyCredits },
          });
        }

        let creditsGranted = 0;
        if (input.grantMonthlyCredits) {
          if (
            !monthlyEntitlementIsAllowed({
              externalInvoiceId: input.externalInvoiceId,
              subscriptionStatus: status,
              billingReason: input.billingReason,
              currentPeriodStart: input.currentPeriodStart,
            })
          ) {
            throw new AppError(
              "BILLING_ENTITLEMENT_INVALID",
              "Credits can only be granted for a paid invoice on an active subscription.",
              500,
            );
          }
          const periodStart = input.currentPeriodStart!;
          const idempotencyKey = `stripe:subscription:${input.externalSubscriptionId}:period:${periodStart.toISOString()}:monthly-grant`;
          const existingGrant = await tx.creditLedger.findUnique({
            where: { idempotencyKey },
          });
          if (!existingGrant) {
            const changed = await tx.workspace.update({
              where: { id: workspaceId },
              data: { creditBalance: { increment: plan.monthlyCredits } },
              select: { creditBalance: true },
            });
            await tx.creditLedger.create({
              data: {
                workspaceId,
                type: "MONTHLY_GRANT",
                amount: plan.monthlyCredits,
                balanceAfter: changed.creditBalance,
                referenceType: "stripe_invoice",
                referenceId: input.externalInvoiceId,
                idempotencyKey,
                description: `${plan.id} monthly credits after paid invoice`,
                metadata: {
                  provider: input.provider,
                  externalSubscriptionId: input.externalSubscriptionId,
                  priceId: plan.priceId,
                  periodStart: periodStart.toISOString(),
                  periodEnd: input.currentPeriodEnd?.toISOString(),
                },
              },
            });
            creditsGranted = plan.monthlyCredits;
          }
        }

        const outcome = stale ? "STALE" : "PROCESSED";
        await tx.billingEvent.create({
          data: {
            providerEventKey: providerEventKey(input),
            provider: input.provider,
            externalEventId: input.externalEventId,
            type: input.type,
            workspaceId,
            externalInvoiceId: input.externalInvoiceId,
            payloadDigest: input.payloadDigest,
            outcome,
            providerCreatedAt: input.providerCreatedAt,
          },
        });
        return {
          replayed: false,
          workspaceId,
          outcome,
          creditsGranted,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const replay = await replayResult(input, database);
      if (replay) return replay;
    }
    throw error;
  }
}

export async function createCheckout(input: {
  workspaceId: string;
  userId: string;
  plan: BillablePlan;
  idempotencyKey: string;
}) {
  if (!env.billingReady) {
    throw new AppError(
      "BILLING_NOT_CONFIGURED",
      "Paid billing is not available for this environment.",
      503,
    );
  }
  const selectedPlan = billingPlan(input.plan);
  if (!selectedPlan.priceId) {
    throw new AppError(
      "BILLING_PLAN_NOT_CONFIGURED",
      "This billing plan is not available.",
      503,
    );
  }
  const [user, subscription] = await Promise.all([
    db.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    }),
    db.subscription.findFirst({
      where: { workspaceId: input.workspaceId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!user?.email) {
    throw new AppError(
      "BILLING_EMAIL_REQUIRED",
      "A verified account email is required for billing.",
      422,
    );
  }
  if (
    subscription?.externalSubscriptionId &&
    subscription.status !== "CANCELLED"
  ) {
    throw new AppError(
      "SUBSCRIPTION_EXISTS",
      "Manage the existing subscription from the billing portal.",
      409,
    );
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      line_items: [{ price: selectedPlan.priceId, quantity: 1 }],
      client_reference_id: input.workspaceId,
      ...(subscription?.externalCustomerId
        ? {
            customer: subscription.externalCustomerId,
            customer_update: { address: "auto", name: "auto" },
          }
        : { customer_email: user.email }),
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: env.billingTaxMode === "stripe" },
      allow_promotion_codes: true,
      success_url: `${env.NEXT_PUBLIC_APP_URL}/billing?checkout=success`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/billing?checkout=cancelled`,
      metadata: {
        athreixWorkspaceId: input.workspaceId,
        athreixPlan: input.plan,
      },
      subscription_data: {
        metadata: {
          athreixWorkspaceId: input.workspaceId,
          athreixPlan: input.plan,
        },
      },
    },
    { idempotencyKey: `checkout:${input.workspaceId}:${input.idempotencyKey}` },
  );
  if (!session.url) {
    throw new AppError(
      "BILLING_CHECKOUT_UNAVAILABLE",
      "The payment provider did not return a checkout URL.",
      502,
    );
  }
  return { sessionId: session.id, url: session.url };
}

export async function createCustomerPortal(workspaceId: string) {
  if (!env.billingReady) {
    throw new AppError(
      "BILLING_NOT_CONFIGURED",
      "Paid billing is not available for this environment.",
      503,
    );
  }
  const subscription = await db.subscription.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription?.externalCustomerId) {
    throw new AppError(
      "BILLING_CUSTOMER_NOT_FOUND",
      "This workspace does not have a managed billing account yet.",
      404,
    );
  }
  const session = await getStripe().billingPortal.sessions.create({
    customer: subscription.externalCustomerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/billing`,
  });
  return { url: session.url };
}
