import { apiRoute, apiSuccess } from "@/lib/server/api";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { getPaddle } from "@/lib/server/paddle";
import {
  applyBillingEvent,
  normalizePaddleEvent,
} from "@/server/billing-service";

const maximumWebhookBytes = 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: Request) {
  return apiRoute(async () => {
    if (!env.billingReady || !env.PADDLE_WEBHOOK_SECRET) {
      throw new AppError(
        "BILLING_NOT_CONFIGURED",
        "The billing webhook is not configured.",
        503,
      );
    }
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > maximumWebhookBytes
    ) {
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        "The webhook payload is too large.",
        413,
      );
    }
    const signature = request.headers.get("paddle-signature");
    if (!signature) {
      throw new AppError(
        "BILLING_SIGNATURE_REQUIRED",
        "The payment-provider signature is required.",
        400,
      );
    }
    const rawPayload = await request.text();
    if (new TextEncoder().encode(rawPayload).byteLength > maximumWebhookBytes) {
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        "The webhook payload is too large.",
        413,
      );
    }
    const paddle = getPaddle();
    let event;
    try {
      event = await paddle.webhooks.unmarshal(
        rawPayload,
        env.PADDLE_WEBHOOK_SECRET,
        signature,
      );
    } catch {
      throw new AppError(
        "BILLING_SIGNATURE_INVALID",
        "The payment-provider signature is invalid.",
        400,
      );
    }
    const normalized = normalizePaddleEvent(event, rawPayload);
    const result = await applyBillingEvent(normalized);
    return apiSuccess({ received: true, ...result });
  });
}
