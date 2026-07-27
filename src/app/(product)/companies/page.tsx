"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CircleDot,
  Radar,
  Search,
  Sparkles,
} from "lucide-react";
import { demoCompanyIntelligence } from "@/lib/intelligence/demo";
import { requestOrFallback } from "@/lib/demo/client";
import { EmptyState, PageHeader, Surface } from "@/components/product/ui";

type CompanyRow = {
  id: string;
  name: string;
  industry?: string;
  location?: string;
  employeeRange?: string;
  score: number;
  buyingIntent: number;
  confidence: number;
  signal?: string;
  website?: string;
  updatedAt: string;
};

const fallbackCompanies: CompanyRow[] = demoCompanyIntelligence.map(
  (company) => ({
    id: company.id,
    name: company.name,
    industry: company.industry,
    location: company.location,
    employeeRange: company.employeeRange,
    score: company.scores.overall,
    buyingIntent: company.scores.buyingIntent,
    confidence: company.scores.confidence,
    signal: company.buyingSignals[0]?.title,
    website: company.website,
    updatedAt: company.lastResearchedAt,
  }),
);

function initials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    requestOrFallback<{ data: CompanyRow[] }>("/api/companies", {
      data: fallbackCompanies,
    })
      .then(({ data }) => {
        if (active) {
          setCompanies(data.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setCompanies([]);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value
      ? companies.filter((company) =>
          [company.name, company.industry, company.location, company.signal]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(value),
        )
      : companies;
  }, [companies, query]);

  return (
    <div className="animate-reveal space-y-7">
      <PageHeader
        title="Company intelligence"
        description="Prioritized account dossiers with verified buying signals, website analysis, decision-makers, and recommended next actions."
        action={
          <Link
            href="/search"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <Sparkles className="size-4" />
            New research
          </Link>
        }
      />

      <Surface className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">
            Account portfolio
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Search by company, market, location, or observed buying signal.
          </p>
        </div>
        <label className="flex w-full max-w-xl items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950">
          <Search className="size-4 text-slate-400" />
          <span className="sr-only">Search company intelligence</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search companies, signals, industries..."
            className="min-h-11 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
          />
        </label>
      </Surface>

      {filtered.length ? (
        <Surface className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(14rem,1.25fr)_6rem_9rem_8rem_minmax(13rem,1fr)_2rem] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 lg:grid dark:border-slate-800 dark:bg-slate-900/60">
            <span>Company</span>
            <span>Score</span>
            <span>Buying intent</span>
            <span>Confidence</span>
            <span>Primary signal</span>
            <span />
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((company) => (
              <Link
                key={company.id}
                href={`/company/${encodeURIComponent(company.id)}`}
                className="group grid gap-4 px-5 py-4 outline-none transition-colors hover:bg-blue-50/40 focus-visible:bg-blue-50 lg:grid-cols-[minmax(14rem,1.25fr)_6rem_9rem_8rem_minmax(13rem,1fr)_2rem] lg:items-center dark:hover:bg-blue-950/20 dark:focus-visible:bg-blue-950/30"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-blue-100 bg-blue-50 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
                    {initials(company.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {company.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {[company.industry, company.location]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </span>

                <span className="flex items-center justify-between lg:block">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 lg:hidden">
                    Score
                  </span>
                  <span className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                    {company.score}
                  </span>
                </span>

                <span>
                  <span className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="lg:hidden">Buying intent</span>
                    <span className="ml-auto font-mono tabular-nums">
                      {company.buyingIntent}%
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <span
                      className="block h-full rounded-full bg-blue-600 dark:bg-blue-400"
                      style={{ width: `${company.buyingIntent}%` }}
                    />
                  </span>
                </span>

                <span className="flex items-center justify-between text-sm lg:block">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 lg:hidden">
                    Confidence
                  </span>
                  <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {company.confidence}%
                  </span>
                </span>

                <span className="flex min-w-0 items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
                  <CircleDot className="mt-1 size-3 shrink-0 text-emerald-500" />
                  <span className="line-clamp-2">
                    {company.signal ?? "No recent signal"}
                  </span>
                </span>

                <ArrowRight className="hidden size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600 lg:block" />
              </Link>
            ))}
          </div>
        </Surface>
      ) : (
        <Surface>
          <EmptyState
            icon={
              loading ? (
                <Radar className="size-5 animate-pulse" />
              ) : (
                <Building2 className="size-5" />
              )
            }
            title={
              loading ? "Loading company intelligence" : "No companies found"
            }
            description={
              loading
                ? "Preparing the latest research dossiers."
                : "Try a broader company, industry, location, or signal."
            }
          />
        </Surface>
      )}
    </div>
  );
}
