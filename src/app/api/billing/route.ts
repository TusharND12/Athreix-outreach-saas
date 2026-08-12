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
        externalSubscriptionId: true,
        externalPriceId: true,
      },
    });
    const subscriptionMatchesEnvironment = Boolean(
      subscription &&
      (!subscription.externalCustomerId && !subscription.externalSubscriptionId
        ? true
        : !subscription.externalPriceId ||
          Object.values(env.billingPriceIds).includes(
            subscription.externalPriceId,
          )),
    );
    return apiSuccess({
      subscription:
        subscription && subscriptionMatchesEnvironment
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
        ? `Checkout, tax calculation, and subscription management are handled by Paddle ${env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "Live" : "Sandbox"}.`
        : "Paid billing is fail-closed until environment-matched Paddle credentials, the signed webhook, client token, and all price IDs are configured.",
    });
  });
}
