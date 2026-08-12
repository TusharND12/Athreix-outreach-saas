import "server-only";
import {
  Environment,
  LogLevel,
  Paddle,
  type Price,
} from "@paddle/paddle-node-sdk";
import { env } from "@/lib/server/env";

let paddle: Paddle | undefined;

export function getPaddle() {
  if (!env.PADDLE_API_KEY) {
    throw new Error("PADDLE_API_KEY is not configured");
  }
  paddle ??= new Paddle(env.PADDLE_API_KEY, {
    environment:
      env.NEXT_PUBLIC_PADDLE_ENV === "production"
        ? Environment.production
        : Environment.sandbox,
    logLevel: LogLevel.error,
  });
  return paddle;
}

function isConfiguredMonthlyPrice(price: Price) {
  return (
    price.status === "active" &&
    price.billingCycle?.interval === "month" &&
    price.billingCycle.frequency === 1
  );
}

export async function billingProviderIsReachable() {
  if (!env.billingReady) return false;
  try {
    const prices = await Promise.all(
      Object.values(env.billingPriceIds).map((priceId) =>
        getPaddle().prices.get(priceId!),
      ),
    );
    return prices.every(isConfiguredMonthlyPrice);
  } catch {
    return false;
  }
}
