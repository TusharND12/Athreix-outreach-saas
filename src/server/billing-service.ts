import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  EventName,
  type EventEntity,
  type SubscriptionActivatedEvent,
  type SubscriptionCanceledEvent,
  type SubscriptionCreatedEvent,
  type SubscriptionPastDueEvent,
  type SubscriptionPausedEvent,
  type SubscriptionResumedEvent,
  type SubscriptionTrialingEvent,
  type SubscriptionUpdatedEvent,
  type TransactionCompletedEvent,
} from "@paddle/paddle-node-sdk";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { getPaddle } from "@/lib/server/paddle";
import {
  billingPlan,
  billingPlanForPrice,
  type BillablePlan,
} from "@/server/billing-plans";

type InternalSubscriptionStatus =
  "TRIALING" | "ACTIVE" | "PAST_DUE" | "PAUSED" | "CANCELLED";

export type NormalizedBillingEvent = {
  provider: "paddle";
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

function validWorkspaceMetadata(value: string | undefined) {
  if (!value || value.length > 128 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return undefined;
  }
  return value;
}

function stringCustomData(
  customData: Record<string, unknown> | null,
  key: string,
) {
  const value = customData?.[key];
  return typeof value === "string" ? value : undefined;
}

function providerEventKey(
  input: Pick<NormalizedBillingEvent, "provider" | "externalEventId">,
) {
  return `${input.provider}:${input.externalEventId}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function paddlePayloadDigest(rawPayload: string) {
  const envelope = JSON.parse(rawPayload) as Record<string, unknown>;
  // A replay may mint a new delivery notification while retaining the same
  // provider event. Notification IDs are transport metadata, not event data.
  delete envelope.notification_id;
  return createHash("sha256").update(canonicalJson(envelope)).digest("hex");
}

type PaddleSubscriptionEvent =
  | SubscriptionActivatedEvent
  | SubscriptionCanceledEvent
  | SubscriptionCreatedEvent
  | SubscriptionPastDueEvent
  | SubscriptionPausedEvent
  | SubscriptionResumedEvent
  | SubscriptionTrialingEvent
  | SubscriptionUpdatedEvent;

function normalizeSubscription(
  base: Pick<
    NormalizedBillingEvent,
    | "provider"
    | "externalEventId"
    | "type"
    | "payloadDigest"
    | "providerCreatedAt"
  >,
  event: PaddleSubscriptionEvent,
): NormalizedBillingEvent {
  const subscription = event.data;
  const item = subscription.items[0];
  if (
    !item?.price?.id ||
    subscription.items.length !== 1 ||
    item.quantity !== 1 ||
    !item.recurring
  ) {
    throw new AppError(
      "BILLING_SUBSCRIPTION_SHAPE_INVALID",
      "The subscription does not contain exactly one Athreix plan.",
      500,
    );
  }
  const workspaceId = validWorkspaceMetadata(
    stringCustomData(subscription.customData, "athreix_workspace_id"),
  );
  return {
    ...base,
    handled: true,
    workspaceId,
    externalCustomerId: subscription.customerId,
    externalSubscriptionId: subscription.id,
    externalInvoiceId:
      event.eventType === EventName.SubscriptionCreated
        ? event.data.transactionId
        : undefined,
    priceId: item.price.id,
    providerStatus: subscription.status,
    currentPeriodStart: subscription.currentBillingPeriod
      ? new Date(subscription.currentBillingPeriod.startsAt)
      : undefined,
    currentPeriodEnd: subscription.currentBillingPeriod
      ? new Date(subscription.currentBillingPeriod.endsAt)
      : undefined,
    cancelAtPeriodEnd: subscription.scheduledChange?.action === "cancel",
  };
}

function normalizeTransaction(
  base: Pick<
    NormalizedBillingEvent,
    | "provider"
    | "externalEventId"
    | "type"
    | "payloadDigest"
    | "providerCreatedAt"
  >,
  event: TransactionCompletedEvent,
): NormalizedBillingEvent {
  const transaction = event.data;
  const item = transaction.items[0];
  if (
    !transaction.customerId ||
    !transaction.subscriptionId ||
    !item?.price?.id ||
    transaction.items.length !== 1 ||
    item.quantity !== 1 ||
    !item.price.billingCycle
  ) {
    throw new AppError(
      "BILLING_SUBSCRIPTION_SHAPE_INVALID",
      "The completed transaction does not contain exactly one Athreix subscription plan.",
      500,
    );
  }
  return {
    ...base,
    handled: true,
    workspaceId: validWorkspaceMetadata(
      stringCustomData(transaction.customData, "athreix_workspace_id"),
    ),
    externalCustomerId: transaction.customerId,
    externalSubscriptionId: transaction.subscriptionId,
    externalInvoiceId: transaction.id,
    priceId: item.price.id,
    providerStatus: "active",
    currentPeriodStart: transaction.billingPeriod
      ? new Date(transaction.billingPeriod.startsAt)
      : undefined,
    currentPeriodEnd: transaction.billingPeriod
      ? new Date(transaction.billingPeriod.endsAt)
      : undefined,
    cancelAtPeriodEnd: false,
    grantMonthlyCredits:
      transaction.status === "completed" &&
      ["web", "subscription_recurring"].includes(transaction.origin) &&
      Boolean(transaction.billingPeriod),
    billingReason: transaction.origin,
  };
}

export function normalizePaddleEvent(
  event: EventEntity,
  rawPayload: string,
): NormalizedBillingEvent {
  const base = {
    provider: "paddle" as const,
    externalEventId: event.eventId,
    type: event.eventType,
    payloadDigest: paddlePayloadDigest(rawPayload),
    providerCreatedAt: new Date(event.occurredAt),
  };

  switch (event.eventType) {
    case EventName.SubscriptionActivated:
    case EventName.SubscriptionCanceled:
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionPastDue:
    case EventName.SubscriptionPaused:
    case EventName.SubscriptionResumed:
    case EventName.SubscriptionTrialing:
    case EventName.SubscriptionUpdated:
      return normalizeSubscription(base, event);
    case EventName.TransactionCompleted:
      return normalizeTransaction(base, event);
    default:
      return { ...base, handled: false };
  }
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

function subscriptionMatchesConfiguredCatalog(
  subscription?: {
    externalCustomerId?: string | null;
    externalSubscriptionId?: string | null;
    externalPriceId?: string | null;
  } | null,
) {
  if (
    !subscription?.externalCustomerId &&
    !subscription?.externalSubscriptionId
  ) {
    return true;
  }
  // Legacy managed rows may predate price tracking. Keep those fail-closed;
  // otherwise, only reuse provider identifiers from the configured Paddle
  // environment. Sandbox and Live IDs are not interchangeable.
  return (
    !subscription.externalPriceId ||
    Boolean(billingPlanForPrice(subscription.externalPriceId))
  );
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
    ["web", "subscription_recurring"].includes(input.billingReason ?? "") &&
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

        const fallbackSubscription = await tx.subscription.findFirst({
          where: { workspaceId },
          orderBy: { createdAt: "desc" },
        });
        const localSubscription =
          bySubscription ??
          byCustomer ??
          (subscriptionMatchesConfiguredCatalog(fallbackSubscription)
            ? fallbackSubscription
            : undefined);
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
              "Credits can only be granted for a completed recurring subscription transaction.",
              500,
            );
          }
          const periodStart = input.currentPeriodStart!;
          const idempotencyKey = `paddle:transaction:${input.externalInvoiceId}:monthly-grant`;
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
                referenceType: "paddle_transaction",
                referenceId: input.externalInvoiceId,
                idempotencyKey,
                description: `${plan.id} monthly credits after completed Paddle transaction`,
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
    subscriptionMatchesConfiguredCatalog(subscription) &&
    subscription?.externalSubscriptionId &&
    subscription.status !== "CANCELLED"
  ) {
    throw new AppError(
      "SUBSCRIPTION_EXISTS",
      "Manage the existing subscription from the billing portal.",
      409,
    );
  }

  const sessionId = `paddle_checkout_${createHash("sha256")
    .update(`${input.workspaceId}:${input.idempotencyKey}`)
    .digest("hex")
    .slice(0, 24)}`;
  return {
    sessionId,
    priceId: selectedPlan.priceId,
    customer:
      subscriptionMatchesConfiguredCatalog(subscription) &&
      subscription?.externalCustomerId
        ? { id: subscription.externalCustomerId }
        : { email: user.email },
    customData: {
      athreix_workspace_id: input.workspaceId,
      athreix_plan: input.plan,
    },
  };
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
  if (
    !subscriptionMatchesConfiguredCatalog(subscription) ||
    !subscription?.externalCustomerId
  ) {
    throw new AppError(
      "BILLING_CUSTOMER_NOT_FOUND",
      "This workspace does not have a managed billing account yet.",
      404,
    );
  }
  const subscriptionIds = subscription.externalSubscriptionId
    ? [subscription.externalSubscriptionId]
    : [];
  const session = await getPaddle().customerPortalSessions.create(
    subscription.externalCustomerId,
    subscriptionIds,
  );
  return { url: session.urls.general.overview };
}

export async function cancelSubscription(workspaceId: string) {
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
  if (
    !subscriptionMatchesConfiguredCatalog(subscription) ||
    !subscription?.externalSubscriptionId ||
    !subscription.externalCustomerId ||
    subscription.status === "CANCELLED"
  ) {
    throw new AppError(
      "BILLING_SUBSCRIPTION_NOT_FOUND",
      "This workspace does not have an active managed subscription.",
      404,
    );
  }
  const canceled = await getPaddle().subscriptions.cancel(
    subscription.externalSubscriptionId,
    { effectiveFrom: "next_billing_period" },
  );
  return {
    subscriptionId: canceled.id,
    status: canceled.status,
    scheduledChange: canceled.scheduledChange?.effectiveAt ?? null,
  };
}
