import { env } from "@/lib/server/env";

export type BillablePlan = "STARTER" | "GROWTH" | "SCALE";

const monthlyCredits: Record<BillablePlan, number> = {
  STARTER: 250,
  GROWTH: 500,
  SCALE: 1_000,
};

export const billingPlans = (Object.keys(monthlyCredits) as BillablePlan[]).map(
  (id) => ({
    id,
    monthlyCredits: monthlyCredits[id],
    priceId: env.billingPriceIds[id],
    billingAvailable: Boolean(env.billingReady && env.billingPriceIds[id]),
  }),
);

export function isBillablePlan(value: string): value is BillablePlan {
  return value in monthlyCredits;
}

export function billingPlan(plan: BillablePlan) {
  return billingPlans.find((candidate) => candidate.id === plan)!;
}

export function billingPlanForPrice(priceId?: string) {
  if (!priceId) return undefined;
  return (Object.keys(monthlyCredits) as BillablePlan[])
    .map(billingPlan)
    .find((plan) => plan.priceId === priceId);
}
