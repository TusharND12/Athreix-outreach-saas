import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { requireContext } from "@/server/auth-context";

const plans = [
  { id: "STARTER", monthlyCredits: 250, billingAvailable: false },
  { id: "GROWTH", monthlyCredits: 500, billingAvailable: false },
  { id: "SCALE", monthlyCredits: 1_000, billingAvailable: false },
] as const;

export async function GET() {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    if (context.demo)
      return apiSuccess({
        subscription: { plan: "GROWTH", status: "TRIALING" },
        plans,
        notice: "Payment processing will be connected before paid onboarding.",
      });
    const subscription = await db.subscription.findFirst({
      where: { workspaceId: context.workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess({
      subscription,
      plans,
      notice: "Payment processing is not yet enabled.",
    });
  });
}
