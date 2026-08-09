import { apiRoute, apiSuccess } from "@/lib/server/api";
import { AppError } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireContext } from "@/server/auth-context";
import { createCustomerPortal } from "@/server/billing-service";
import { writeAudit } from "@/server/audit";

export async function POST() {
  return apiRoute(async () => {
    const context = await requireContext("OWNER");
    if (context.demo) {
      throw new AppError(
        "BILLING_NOT_AVAILABLE_IN_DEMO",
        "Subscription management is disabled in preview mode.",
        409,
      );
    }
    await enforceRateLimit(
      `billing:portal:${context.workspaceId}:${context.userId}`,
      10,
      60,
    );
    const result = await createCustomerPortal(context.workspaceId);
    await writeAudit({
      workspaceId: context.workspaceId,
      actorId: context.userId,
      action: "billing.portal.created",
      entityType: "workspace",
      entityId: context.workspaceId,
    });
    return apiSuccess(result, { status: 201 });
  });
}
