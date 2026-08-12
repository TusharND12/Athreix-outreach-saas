import { apiRoute, apiSuccess } from "@/lib/server/api";
import { AppError } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireContext } from "@/server/auth-context";
import { cancelSubscription } from "@/server/billing-service";
import { writeAudit } from "@/server/audit";

export async function POST() {
  return apiRoute(async () => {
    const context = await requireContext("OWNER");
    if (context.demo) {
      throw new AppError(
        "BILLING_NOT_AVAILABLE_IN_DEMO",
        "Subscription cancellation is disabled in preview mode.",
        409,
      );
    }
    await enforceRateLimit(
      `billing:cancel:${context.workspaceId}:${context.userId}`,
      5,
      60,
    );
    const result = await cancelSubscription(context.workspaceId);
    await writeAudit({
      workspaceId: context.workspaceId,
      actorId: context.userId,
      action: "billing.subscription.cancel_scheduled",
      entityType: "subscription",
      entityId: result.subscriptionId,
      metadata: { effectiveAt: result.scheduledChange },
    });
    return apiSuccess(result);
  });
}
