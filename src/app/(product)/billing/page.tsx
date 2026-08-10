"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { CheckoutCustomer, Paddle } from "@paddle/paddle-js";
import { ArrowRight, Check, CreditCard, ShieldCheck } from "lucide-react";
import {
  Button,
  InlineNotice,
  PageHeader,
  StatusBadge,
  Surface,
} from "@/components/product/ui";
import { requestOrFallback } from "@/lib/demo/client";
import { getPaddleClient } from "@/lib/paddle-client";

type BillingResponse = {
  data?: {
    subscription?: {
      plan?: string;
      status?: string;
      managed?: boolean;
      cancelAtPeriodEnd?: boolean;
      currentPeriodEnd?: string | null;
    } | null;
    plans?: Array<{
      id: string;
      monthlyCredits: number;
      priceId?: string;
      billingAvailable: boolean;
    }>;
    notice?: string;
    billing?: { ready: boolean; provider?: string | null };
  };
  meta?: { demo?: boolean };
};

export default function BillingPage() {
  const { data: session } = useSession();
  const [billing, setBilling] = useState<BillingResponse["data"]>({
    subscription: null,
    plans: [],
  });
  const [source, setSource] = useState<"loading" | "live" | "demo" | "error">(
    "loading",
  );
  const [action, setAction] = useState<string>();
  const [actionError, setActionError] = useState("");
  const [paddle, setPaddle] = useState<Paddle>();
  const [prices, setPrices] = useState<Record<string, string>>({});

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
        billing: { ready: false, provider: null },
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

  useEffect(() => {
    let active = true;
    void getPaddleClient()
      .then((client) => {
        if (active && client) setPaddle(client);
      })
      .catch(() => {
        if (active) setPaddle(undefined);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const priceIds = (billing?.plans ?? [])
      .map((plan) => plan.priceId)
      .filter((priceId): priceId is string => Boolean(priceId));
    if (!paddle || priceIds.length === 0) return;
    let active = true;
    void paddle
      .PricePreview({
        items: priceIds.map((priceId) => ({ priceId, quantity: 1 })),
      })
      .then((preview) => {
        if (!active) return;
        setPrices(
          Object.fromEntries(
            preview.data.details.lineItems.map((item) => [
              item.price.id,
              item.formattedTotals.total,
            ]),
          ),
        );
      })
      .catch(() => {
        if (active) setPrices({});
      });
    return () => {
      active = false;
    };
  }, [billing?.plans, paddle]);

  const currentPlan = billing?.subscription?.plan;
  const canManage = session?.user?.role === "OWNER";
  const billingReady = Boolean(billing?.billing?.ready);
  const managed = Boolean(billing?.subscription?.managed);

  const openProvider = async (endpoint: string, plan?: string) => {
    setAction(plan ?? "portal");
    setActionError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...(plan ? { "content-type": "application/json" } : {}),
          "idempotency-key": crypto.randomUUID(),
        },
        body: plan ? JSON.stringify({ plan }) : undefined,
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: {
          url?: string;
          priceId?: string;
          customer?: { id?: string; email?: string };
          customData?: Record<string, unknown>;
        };
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ?? "The billing action could not be started.",
        );
      }
      if (payload.data.url) {
        window.location.assign(payload.data.url);
        return;
      }
      if (!payload.data.priceId) {
        throw new Error("Paddle did not return an authorized checkout plan.");
      }
      const client = paddle ?? (await getPaddleClient());
      if (!client) {
        throw new Error("Paddle Sandbox checkout is not configured.");
      }
      const checkoutCustomer: CheckoutCustomer | undefined = payload.data
        .customer?.id
        ? { id: payload.data.customer.id }
        : payload.data.customer?.email
          ? { email: payload.data.customer.email }
          : undefined;
      if (!checkoutCustomer) {
        throw new Error("Paddle checkout is missing customer details.");
      }
      client.Checkout.open({
        items: [{ priceId: payload.data.priceId, quantity: 1 }],
        customer: checkoutCustomer,
        customData: payload.data.customData,
        settings: {
          variant: "one-page",
          allowLogout: false,
          showAddTaxId: true,
          successUrl: `${window.location.origin}/billing?checkout=success`,
        },
      });
      setAction(undefined);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The billing action could not be started.",
      );
      setAction(undefined);
    }
  };

  const scheduleCancellation = async () => {
    if (
      !window.confirm(
        "Schedule cancellation for the end of the current billing period?",
      )
    )
      return;
    setAction("cancel");
    setActionError("");
    try {
      const response = await fetch("/api/billing/cancel", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as {
        data?: { scheduledChange?: string | null };
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ?? "Cancellation could not be scheduled.",
        );
      }
      setBilling((current) =>
        current?.subscription
          ? {
              ...current,
              subscription: {
                ...current.subscription,
                cancelAtPeriodEnd: true,
                currentPeriodEnd:
                  payload.data?.scheduledChange ??
                  current.subscription.currentPeriodEnd,
              },
            }
          : current,
      );
      setAction(undefined);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Cancellation could not be scheduled.",
      );
      setAction(undefined);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        title="Billing"
        description="Review credit tiers, subscription state, and secure Paddle Sandbox checkout. Credits are granted only after a verified completed subscription transaction."
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
      {actionError ? (
        <InlineNotice title="Billing action failed" tone="danger">
          <p>{actionError}</p>
        </InlineNotice>
      ) : null}
      {!billingReady && source !== "loading" ? (
        <InlineNotice title="Paid billing is disabled" tone="warning">
          <p>
            Checkout remains fail-closed until the Paddle Sandbox API key,
            client token, signed webhook, and all plan price IDs are configured.
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
                  {billing.subscription.status === "TRIALING" && !managed
                    ? "preview"
                    : billing.subscription.status.toLowerCase()}
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
          {billingReady && managed && canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                loading={action === "portal"}
                onClick={() => void openProvider("/api/billing/portal")}
              >
                <CreditCard className="size-4" />
                Manage billing
              </Button>
              {!billing?.subscription?.cancelAtPeriodEnd &&
              billing?.subscription?.status !== "CANCELLED" ? (
                <Button
                  variant="secondary"
                  loading={action === "cancel"}
                  onClick={() => void scheduleCancellation()}
                >
                  Cancel at period end
                </Button>
              ) : null}
            </div>
          ) : null}
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
            Prices and taxes are shown by the payment provider. Monthly credits
            are appended to the ledger only after a signed completed-transaction
            event; plan changes and cancellations are managed in the provider
            portal.
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
                <p className="mt-3 text-sm font-medium">
                  {plan.priceId && prices[plan.priceId]
                    ? `${prices[plan.priceId]} / month`
                    : "Localized price shown in checkout"}
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
                <Button
                  className="mt-4 w-full"
                  variant={current && managed ? "secondary" : "primary"}
                  disabled={
                    !billingReady ||
                    !canManage ||
                    managed ||
                    !plan.billingAvailable
                  }
                  loading={action === plan.id}
                  onClick={() =>
                    void openProvider("/api/billing/checkout", plan.id)
                  }
                >
                  {managed ? "Manage current subscription" : "Choose plan"}
                </Button>
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
          {billing?.notice ?? "Payment processing is not enabled."} Card details
          are handled by the payment provider; Athreix never stores raw card
          numbers or security codes. Only workspace owners can start checkout or
          open subscription management.
        </p>
      </InlineNotice>
    </div>
  );
}
