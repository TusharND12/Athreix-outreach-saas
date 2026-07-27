"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Coins,
  Download,
  Info,
  ShieldCheck,
} from "lucide-react";
import {
  Button,
  EmptyState,
  InlineNotice,
  PageHeader,
  SectionHeading,
  StatusBadge,
  Surface,
} from "@/components/product/ui";
import { requestOrFallback } from "@/lib/demo/client";

type LedgerRow = {
  id: string;
  date: string;
  event: string;
  kind: string;
  used: number;
  refunded: number;
};
type UsageResponse = {
  data?: {
    balance?: number;
    reserved?: number;
    monthlyCap?: number;
    transactions?: Array<{
      id?: string;
      type?: string;
      amount?: number;
      referenceId?: string;
      createdAt?: string;
    }>;
  };
  meta?: { demo?: boolean };
};

const defaultSearchLimit = 100;

export default function UsagePage() {
  const [usage, setUsage] = useState({
    balance: 0,
    reserved: 0,
    monthlyCap: 0,
  });
  const [usageLedger, setUsageLedger] = useState<LedgerRow[]>([]);
  const [source, setSource] = useState<"loading" | "live" | "demo" | "error">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    requestOrFallback<UsageResponse>("/api/usage", {
      data: { balance: 188, reserved: 0, monthlyCap: 500, transactions: [] },
      meta: { demo: true },
    })
      .then(({ data, source: responseSource }) => {
        if (!active) return;
        const payload = data.data;
        setUsage({
          balance: payload?.balance ?? 0,
          reserved: payload?.reserved ?? 0,
          monthlyCap: payload?.monthlyCap ?? 0,
        });
        setUsageLedger(
          (payload?.transactions ?? []).map((item, index) => ({
            id: item.id ?? `credit-${index}`,
            date: item.createdAt
              ? new Date(item.createdAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Recently",
            event: item.referenceId ?? item.id ?? "Credit event",
            kind: item.type?.replaceAll("_", " ").toLowerCase() ?? "Usage",
            used: (item.amount ?? 0) < 0 ? Math.abs(item.amount ?? 0) : 0,
            refunded: (item.amount ?? 0) > 0 ? (item.amount ?? 0) : 0,
          })),
        );
        setSource(
          responseSource === "demo" || data.meta?.demo ? "demo" : "live",
        );
      })
      .catch(() => {
        if (active) setSource("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const availableAfterReservations = Math.max(
    0,
    usage.balance - usage.reserved,
  );
  const reservedPercent = usage.balance
    ? Math.min(100, Math.round((usage.reserved / usage.balance) * 100))
    : 0;

  return (
    <div className="space-y-7">
      <PageHeader
        title="Usage and credits"
        description="See the current balance, active reservations, and recorded charges or refunds."
        meta={
          <StatusBadge tone={source === "error" ? "danger" : "neutral"}>
            {source === "loading"
              ? "Loading"
              : source === "demo"
                ? "Preview usage"
                : source === "live"
                  ? "Live ledger"
                  : "Unavailable"}
          </StatusBadge>
        }
        action={
          <Button variant="secondary" onClick={() => window.print()}>
            <Download className="size-4" />
            Print statement
          </Button>
        }
      />
      {source === "error" ? (
        <InlineNotice title="Usage unavailable" tone="danger">
          <p>
            The current balance and ledger could not be loaded. No fallback
            account values are being shown.
          </p>
        </InlineNotice>
      ) : null}

      <Surface className="overflow-hidden">
        <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[1fr_20rem] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="warning">
                <Coins className="size-3" />
                Credit balance
              </StatusBadge>
              {usage.monthlyCap ? (
                <span className="text-xs text-zinc-500">
                  Monthly cap {usage.monthlyCap}
                </span>
              ) : null}
            </div>
            <p className="tabular-nums mt-5 text-5xl font-semibold tracking-[-0.04em] text-zinc-950 dark:text-white">
              {usage.balance}
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              credits in the current workspace balance
            </p>
            <div
              className="mt-6 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
              role="progressbar"
              aria-label="Credits currently reserved"
              aria-valuemin={0}
              aria-valuemax={Math.max(usage.balance, 1)}
              aria-valuenow={usage.reserved}
            >
              <div
                className="h-full rounded-full bg-blue-600 dark:bg-blue-400"
                style={{ width: `${reservedPercent}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
              <span>{usage.reserved} reserved by active jobs</span>
              <span>{availableAfterReservations} available to reserve</span>
            </div>
          </div>
          <div className="border-t border-zinc-200 pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
              Need more capacity?
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Compare the configured plan tiers before starting a larger search.
              Billing activation remains a separate integration.
            </p>
            <Link
              href="/billing"
              className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg text-xs font-medium text-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:text-zinc-200 dark:focus-visible:ring-white"
            >
              Review plan options
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </Surface>

      <div className="grid gap-6 lg:grid-cols-3">
        <Surface className="p-5" aria-labelledby="usage-search-scope-heading">
          <h2
            id="usage-search-scope-heading"
            className="text-sm font-semibold text-zinc-950 dark:text-white"
          >
            Search scope
          </h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-600 dark:text-zinc-400">
                Maximum results
              </dt>
              <dd className="tabular-nums font-medium">{defaultSearchLimit}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-600 dark:text-zinc-400">
                Estimated cost
              </dt>
              <dd className="tabular-nums font-medium">
                up to {defaultSearchLimit} credits
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-600 dark:text-zinc-400">Available</dt>
              <dd className="tabular-nums font-medium">
                {source === "loading"
                  ? "Loading…"
                  : source === "error"
                    ? "Unavailable"
                    : `${availableAfterReservations} credits`}
              </dd>
            </div>
          </dl>
        </Surface>
        <Surface className="p-5">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
            How credits work
          </h2>
          <ul className="mt-4 space-y-3 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              One credit per successfully stored prospect
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              Duplicates are not charged
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              Failed jobs release their reservation
            </li>
            <li className="flex gap-2">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              The ledger is the source of truth for charges and refunds
            </li>
          </ul>
        </Surface>
        <InlineNotice
          title="Usage protection is active"
          icon={<ShieldCheck className="size-4" />}
        >
          <p>
            Searches cannot reserve more credits than the current balance.
            Workspace rate limits, per-job limits, duplicate checks, and
            failure-release accounting are enforced by the server.
          </p>
        </InlineNotice>
      </div>

      <section aria-labelledby="credit-ledger-heading">
        <SectionHeading
          title="Credit ledger"
          description="Recorded debits, reservations, releases, and refunds"
        />
        {usageLedger.length ? (
          <div className="mt-4 overflow-x-auto border-y border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-500">
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Reference</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 text-right font-medium">Used</th>
                  <th className="px-3 py-3 text-right font-medium">Credited</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {usageLedger.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {row.date}
                    </td>
                    <td className="px-3 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {row.event}
                    </td>
                    <td className="px-3 py-3 text-xs capitalize text-zinc-600 dark:text-zinc-400">
                      {row.kind}
                    </td>
                    <td className="tabular-nums px-3 py-3 text-right">
                      {row.used || "—"}
                    </td>
                    <td className="tabular-nums px-3 py-3 text-right text-emerald-700 dark:text-emerald-400">
                      {row.refunded || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Surface className="mt-4">
            <EmptyState
              icon={<Coins className="size-5" />}
              title={
                source === "loading"
                  ? "Loading credit ledger"
                  : "No ledger entries yet"
              }
              description="Search charges and accounting adjustments will appear here."
            />
          </Surface>
        )}
      </section>
    </div>
  );
}
