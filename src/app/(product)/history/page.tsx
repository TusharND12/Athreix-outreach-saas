"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleX,
  Clock3,
  Download,
  History,
  Search,
  Sparkles,
} from "lucide-react";
import {
  Button,
  EmptyState,
  InlineNotice,
  PageHeader,
  StatusBadge,
  Surface,
} from "@/components/product/ui";
import { requestOrFallback } from "@/lib/demo/client";

type SearchHistoryItem = {
  id: string;
  name: string;
  query: string;
  mode: "B2B" | "B2C";
  status: "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED";
  filters?: Record<string, unknown> | null;
  targetCount: number;
  resultCount?: number;
  exportableResultCount?: number;
  chargedCredits?: number;
  retentionUntil: string;
  createdAt: string;
  completedAt?: string;
  _count?: { results?: number };
};

type HistoryResponse = {
  data?: SearchHistoryItem[];
  meta?: {
    demo?: boolean;
    pagination?: {
      page?: number;
      pages?: number;
      total?: number;
    };
  };
};

function statusTone(status: SearchHistoryItem["status"]) {
  if (status === "COMPLETE") return "success" as const;
  if (status === "FAILED") return "danger" as const;
  if (status === "RUNNING") return "info" as const;
  return "warning" as const;
}

function statusIcon(status: SearchHistoryItem["status"]) {
  if (status === "COMPLETE") return <CheckCircle2 className="size-3.5" />;
  if (status === "FAILED") return <CircleX className="size-3.5" />;
  return <Clock3 className="size-3.5" />;
}

function filterValues(item: SearchHistoryItem) {
  if (!item.filters) return [];
  const values = [
    item.filters.locations,
    item.filters.industries,
    item.filters.jobTitles,
    item.filters.keywords,
  ].flatMap((value) =>
    Array.isArray(value)
      ? value.filter(
          (entry): entry is string =>
            typeof entry === "string" && Boolean(entry.trim()),
        )
      : [],
  );
  return Array.from(new Set(values)).slice(0, 4);
}

function resultCount(item: SearchHistoryItem) {
  return item.resultCount ?? item._count?.results ?? item.chargedCredits ?? 0;
}

function exportableResultCount(item: SearchHistoryItem) {
  return item.exportableResultCount ?? resultCount(item);
}

export default function SearchHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState<"loading" | "live" | "error">("loading");

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      const rows: SearchHistoryItem[] = [];
      let page = 1;
      let pages = 1;
      do {
        const response = await requestOrFallback<HistoryResponse>(
          `/api/history?page=${page}&pageSize=100`,
          { data: [], meta: { demo: true, pagination: { page, pages: 1 } } },
        );
        if (!active) return;
        rows.push(...(response.data.data ?? []));
        pages = Math.max(1, response.data.meta?.pagination?.pages ?? 1);
        page += 1;
      } while (page <= pages);
      if (!active) return;
      setHistory(rows);
      setSource("live");
    };
    loadHistory().catch(() => {
      if (active) {
        setHistory([]);
        setSource("error");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return history.filter(
      (item) =>
        (status === "all" || item.status === status) &&
        (!normalizedQuery ||
          `${item.name} ${item.query} ${filterValues(item).join(" ")}`
            .toLowerCase()
            .includes(normalizedQuery)),
    );
  }, [history, query, status]);

  const completed = history.filter((item) => item.status === "COMPLETE").length;
  const failed = history.filter((item) => item.status === "FAILED").length;
  const delivered = history.reduce(
    (total, item) => total + resultCount(item),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search history"
        description="Every live search is saved automatically, including completed and failed attempts. Search metadata survives server restarts and remains subject to the workspace retention policy."
        meta={
          <StatusBadge tone={source === "error" ? "danger" : "neutral"}>
            <History className="size-3" />
            {source === "loading"
              ? "Loading history"
              : source === "live"
                ? "Automatic history"
                : "History unavailable"}
          </StatusBadge>
        }
        action={
          <Button onClick={() => router.push("/search")}>
            <Sparkles className="size-4" />
            New search
          </Button>
        }
      />

      {source === "error" ? (
        <InlineNotice title="Search history unavailable" tone="danger">
          <p>
            Saved searches could not be loaded. New searches are not replaced
            with preview data.
          </p>
        </InlineNotice>
      ) : null}

      <section
        aria-label="Search history summary"
        className="grid divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800"
      >
        {[
          ["All searches", history.length, "Saved automatically"],
          ["Completed", completed, "Provider finished"],
          ["Leads delivered", delivered, "Across retained searches"],
          ["Failed", failed, "Kept for troubleshooting"],
        ].map(([label, value, note]) => (
          <div key={String(label)} className="px-1 py-4 sm:px-5 first:pl-1">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {label}
            </p>
            <p className="tabular-nums mt-1 text-xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
              {value}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{note}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="saved-searches-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="saved-searches-heading"
              className="text-base font-semibold text-slate-950 dark:text-white"
            >
              Saved searches
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Newest searches appear first
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0">
              <span className="sr-only">Search saved history</span>
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search history…"
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label>
              <span className="sr-only">Filter search status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="all">All statuses</option>
                <option value="COMPLETE">Complete</option>
                <option value="RUNNING">Running</option>
                <option value="QUEUED">Queued</option>
                <option value="FAILED">Failed</option>
              </select>
            </label>
          </div>
        </div>

        <Surface className="mt-4 overflow-hidden">
          {source === "loading" ? (
            <div
              className="flex min-h-64 items-center justify-center text-sm text-slate-500"
              role="status"
            >
              Loading saved searches…
            </div>
          ) : filtered.length ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((item) => {
                const filters = filterValues(item);
                const expired = new Date(item.retentionUntil) <= new Date();
                return (
                  <article
                    key={item.id}
                    className="group p-4 transition-colors hover:bg-slate-50 sm:p-5 dark:hover:bg-slate-900/60"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={statusTone(item.status)}>
                            {statusIcon(item.status)}
                            {item.status.toLowerCase()}
                          </StatusBadge>
                          <StatusBadge>{item.mode}</StatusBadge>
                          {expired ? (
                            <StatusBadge tone="warning">Expired</StatusBadge>
                          ) : null}
                        </div>
                        <h3 className="mt-3 truncate text-sm font-semibold text-slate-950 dark:text-white">
                          {item.name}
                        </h3>
                        {item.query ? (
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                            {item.query}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">
                            Search details expired under the retention policy.
                          </p>
                        )}
                        {filters.length ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {filters.map((filter) => (
                              <span
                                key={filter}
                                className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {filter}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <dl className="grid shrink-0 grid-cols-3 gap-4 text-xs lg:w-72">
                        <div>
                          <dt className="text-slate-500">Delivered</dt>
                          <dd className="tabular-nums mt-1 font-semibold text-slate-900 dark:text-white">
                            {resultCount(item)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Requested</dt>
                          <dd className="tabular-nums mt-1 font-semibold text-slate-900 dark:text-white">
                            {item.targetCount}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Created</dt>
                          <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                            <time dateTime={item.createdAt}>
                              {new Date(item.createdAt).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "2-digit",
                                },
                              )}
                            </time>
                          </dd>
                        </div>
                      </dl>
                      <div className="flex shrink-0 gap-2">
                        {item.status === "COMPLETE" &&
                        !expired &&
                        exportableResultCount(item) > 0 ? (
                          <Link
                            href={`/exports?searchId=${encodeURIComponent(item.id)}#create-export`}
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white outline-none transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            <Download className="size-3.5" />
                            Export
                          </Link>
                        ) : null}
                        <Link
                          href={`/search/${encodeURIComponent(item.id)}`}
                          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/40"
                        >
                          View
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<History className="size-5" />}
              title={history.length ? "No searches match" : "No searches yet"}
              description={
                history.length
                  ? "Try a different keyword or status."
                  : "Run your first live lead search and it will be saved here automatically."
              }
              action={
                history.length ? undefined : (
                  <Button onClick={() => router.push("/search")}>
                    Start a search
                  </Button>
                )
              }
            />
          )}
        </Surface>
      </section>
    </div>
  );
}
