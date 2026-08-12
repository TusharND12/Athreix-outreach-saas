import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { AppError, readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireContext } from "@/server/auth-context";
import { createCheckout } from "@/server/billing-service";
import { writeAudit } from "@/server/audit";

const schema = z.object({
  plan: z.enum(["STARTER", "GROWTH", "SCALE"]),
});

export async function POST(request: Request) {
  return apiRoute(async () => {
    const context = await requireContext("OWNER");
    if (context.demo) {
      throw new AppError(
        "BILLING_NOT_AVAILABLE_IN_DEMO",
        "Checkout is disabled in preview mode.",
        409,
      );
    }
    await enforceRateLimit(
      `billing:checkout:${context.workspaceId}:${context.userId}`,
      5,
      60,
    );
    const input = schema.parse(await readJson(request, 8 * 1024));
    const idempotencyKey = request.headers.get("idempotency-key");
    if (
      !idempotencyKey ||
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 200
    ) {
      throw new AppError(
        "INVALID_IDEMPOTENCY_KEY",
        "Idempotency-Key must be between 8 and 200 characters.",
        422,
      );
    }
    const result = await createCheckout({
      workspaceId: context.workspaceId,
      userId: context.userId,
      plan: input.plan,
      idempotencyKey,
    });
    await writeAudit({
      workspaceId: context.workspaceId,
      actorId: context.userId,
      action: "billing.checkout.created",
      entityType: "checkout_session",
      entityId: result.sessionId,
      metadata: { plan: input.plan },
    });
    return apiSuccess(result, { status: 201 });
  });
}
