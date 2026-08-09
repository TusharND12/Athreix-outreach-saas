import { apiRoute, apiSuccess } from "@/lib/server/api";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { getStripe } from "@/lib/server/stripe";
import {
  applyBillingEvent,
  normalizeStripeEvent,
} from "@/server/billing-service";

const maximumWebhookBytes = 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: Request) {
  return apiRoute(async () => {
    if (!env.billingReady || !env.STRIPE_WEBHOOK_SECRET) {
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
    const signature = request.headers.get("stripe-signature");
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
    const stripe = getStripe();
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawPayload,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      throw new AppError(
        "BILLING_SIGNATURE_INVALID",
        "The payment-provider signature is invalid.",
        400,
      );
    }
    const normalized = await normalizeStripeEvent(event, rawPayload, stripe);
    const result = await applyBillingEvent(normalized);
    return apiSuccess({ received: true, ...result });
  });
}
