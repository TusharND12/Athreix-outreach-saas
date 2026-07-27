"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, CreditCard, ShieldCheck } from "lucide-react";
import {
  InlineNotice,
  PageHeader,
  StatusBadge,
  Surface,
} from "@/components/product/ui";
import { requestOrFallback } from "@/lib/demo/client";

type BillingResponse = {
  data?: {
    subscription?: { plan?: string; status?: string } | null;
    plans?: Array<{
      id: string;
      monthlyCredits: number;
      billingAvailable: boolean;
    }>;
    notice?: string;
  };
  meta?: { demo?: boolean };
};

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingResponse["data"]>({
    subscription: null,
    plans: [],
  });
  const [source, setSource] = useState<"loading" | "live" | "demo" | "error">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    const fallback: BillingResponse = {
      data: {
        subscription: { plan: "GROWTH", status: "TRIALING" },
        plans: [
          { id: "STARTER", monthlyCredits: 250, billingAvailable: false },
          { id: "GROWTH", monthlyCredits: 500, billingAvailable: false },
          { id: "SCALE", monthlyCredits: 1000, billingAvailable: false },
        ],
        notice: "Local preview only; payment processing is not enabled.",
      },
      meta: { demo: true },
    };
    requestOrFallback<BillingResponse>("/api/billing", fallback)
      .then(({ data, source: responseSource }) => {
        if (active) {
          setBilling(data.data ?? { subscription: null, plans: [] });
          setSource(
            responseSource === "demo" || data.meta?.demo ? "demo" : "live",
          );
        }
      })
      .catch(() => {
        if (active) {
          setBilling({ subscription: null, plans: [] });
          setSource("error");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const currentPlan = billing?.subscription?.plan;

  return (
    <div className="space-y-7">
      <PageHeader
        title="Billing"
        description="Review configured credit tiers and the workspace subscription record. Payment processing is intentionally not enabled in this MVP."
        meta={
          <StatusBadge tone={source === "error" ? "danger" : "neutral"}>
            {source === "loading"
              ? "Loading"
              : source === "demo"
                ? "Preview configuration"
                : source === "live"
                  ? "Live configuration"
                  : "Unavailable"}
          </StatusBadge>
        }
      />
      {source === "error" ? (
        <InlineNotice title="Billing data unavailable" tone="danger">
          <p>
            No subscription or plan values are being inferred while the service
            is unavailable.
          </p>
        </InlineNotice>
      ) : null}

      <Surface className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-zinc-500">
              Workspace subscription record
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-zinc-950 dark:text-white">
                {currentPlan ?? "No active plan"}
              </h2>
              {billing?.subscription?.status ? (
                <StatusBadge
                  tone={
                    billing.subscription.status === "ACTIVE"
                      ? "success"
                      : "warning"
                  }
                >
                  {billing.subscription.status.toLowerCase()}
                </StatusBadge>
              ) : null}
            </div>
          </div>
          <Link
            href="/usage"
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-800 outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-950 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:focus-visible:ring-white"
          >
            View live credits
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </Surface>

      <section aria-labelledby="plans-heading">
        <div>
          <h2
            id="plans-heading"
            className="text-base font-semibold text-zinc-950 dark:text-white"
          >
            Configured tiers
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Credit grants, renewal timing, rollover, prices, taxes, invoices,
            cancellation, and plan changes require the future Stripe or Razorpay
            integration. They are not simulated here.
          </p>
        </div>
        <div className="mt-4 grid overflow-hidden rounded-xl border border-zinc-200 lg:grid-cols-3 dark:border-zinc-800">
          {(billing?.plans ?? []).map((plan, index) => {
            const current = plan.id === currentPlan;
            return (
              <article
                key={plan.id}
                className={`p-5 sm:p-6 ${index > 0 ? "border-t border-zinc-200 lg:border-l lg:border-t-0 dark:border-zinc-800" : ""} ${current ? "bg-blue-50 text-blue-950 dark:bg-blue-950/30 dark:text-blue-100" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold capitalize">
                    {plan.id.toLowerCase()}
                  </h3>
                  {current ? (
                    <StatusBadge tone="info">Current plan</StatusBadge>
                  ) : null}
                </div>
                <p
                  className={`mt-5 text-3xl font-semibold tracking-[-0.03em] ${current ? "text-blue-950 dark:text-blue-100" : "text-zinc-950 dark:text-white"}`}
                >
                  {plan.monthlyCredits.toLocaleString("en-IN")}
                </p>
                <p
                  className={`mt-1 text-xs ${current ? "text-blue-700/70 dark:text-blue-300/70" : "text-zinc-500"}`}
                >
                  configured monthly-credit tier
                </p>
                <div
                  className={`mt-6 flex items-center gap-2 border-t pt-4 text-xs ${current ? "border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300" : "border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"}`}
                >
                  {plan.billingAvailable ? (
                    <>
                      <Check className="size-3.5" />
                      Billing available
                    </>
                  ) : (
                    <>
                      <CreditCard className="size-3.5" />
                      Payment integration pending
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <InlineNotice
        title="Secure billing handoff"
        icon={<ShieldCheck className="size-4" />}
      >
        <p>
          {billing?.notice ?? "Payment processing is not enabled."} When
          connected, card details should be handled by the payment provider;
          Athreix must never store raw card numbers or security codes.
        </p>
      </InlineNotice>
    </div>
  );
}
