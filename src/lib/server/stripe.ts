import "server-only";

import Stripe from "stripe";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";

let client: Stripe | undefined;
let readinessCache: { checkedAt: number; ready: boolean } | undefined;

export function getStripe() {
  if (!env.billingReady || !env.STRIPE_SECRET_KEY) {
    throw new AppError(
      "BILLING_NOT_CONFIGURED",
      "Paid billing is not available for this environment.",
      503,
    );
  }
  client ??= new Stripe(env.STRIPE_SECRET_KEY, {
    appInfo: { name: "Athreix", version: "0.1.0" },
    maxNetworkRetries: 2,
    timeout: 10_000,
  });
  return client;
}

export async function billingProviderIsReachable() {
  if (!env.billingReady) return false;
  const now = Date.now();
  if (readinessCache && now - readinessCache.checkedAt < 60_000) {
    return readinessCache.ready;
  }
  try {
    const stripe = getStripe();
    const priceEntries = Object.entries(env.billingPriceIds).filter(
      (entry): entry is [string, string] => Boolean(entry[1]),
    );
    if (priceEntries.length !== 3) return false;
    const prices = await Promise.all(
      priceEntries.map(async ([plan, priceId]) => ({
        plan,
        price: await stripe.prices.retrieve(priceId),
      })),
    );
    const ready = prices.every(
      ({ plan, price }) =>
        price.active &&
        price.type === "recurring" &&
        price.recurring?.interval === "month" &&
        price.metadata.athreixPlan === plan,
    );
    readinessCache = { checkedAt: now, ready };
    return ready;
  } catch {
    readinessCache = { checkedAt: now, ready: false };
    return false;
  }
}
