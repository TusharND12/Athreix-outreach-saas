import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { requireContext } from "@/server/auth-context";
import { billingPlans } from "@/server/billing-plans";

export async function GET() {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    if (context.demo)
      return apiSuccess({
        subscription: { plan: "GROWTH", status: "TRIALING" },
        plans: billingPlans.map((plan) => ({
          ...plan,
          billingAvailable: false,
        })),
        billing: { ready: false, provider: null },
        notice: "Payment processing is disabled in preview mode.",
      });
    const subscription = await db.subscription.findFirst({
      where: { workspaceId: context.workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        plan: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        provider: true,
        externalCustomerId: true,
      },
    });
    return apiSuccess({
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            provider: subscription.provider,
            managed: Boolean(subscription.externalCustomerId),
          }
        : null,
      plans: billingPlans,
      billing: {
        ready: env.billingReady,
        provider: env.billingReady ? env.billingProvider : null,
      },
      notice: env.billingReady
        ? "Checkout and subscription management are handled by the configured payment provider."
        : "Paid billing is fail-closed until provider, tax mode, webhook secret, and all price IDs are configured.",
    });
  });
}
