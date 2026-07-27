"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Check,
  ChevronDown,
  Download,
  Filter,
  ListPlus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { LeadDrawer } from "@/components/data/lead-drawer";
import { ProspectTable } from "@/components/data/prospect-table";
import { ExportDialog } from "@/components/product/export-dialog";
import {
  CompletedRunSummary,
  SearchProgress,
} from "@/components/product/search-progress";
import {
  Button,
  EmptyState,
  Field,
  InlineNotice,
  PageHeader,
  SelectField,
  StatusBadge,
  Surface,
} from "@/components/product/ui";
import { ApiRequestError, requestOrFallback } from "@/lib/demo/client";
import {
  listFromApi,
  prospectFromApi,
  type ApiProspect,
} from "@/lib/demo/adapters";
import {
  consumerProspects,
  prospects as demoProspects,
  savedFolders,
} from "@/lib/demo/data";
import type { Prospect, ResearchMode, SavedFolder } from "@/lib/demo/types";

type SortKey = "score" | "newest" | "company" | "location";
type SearchMetadataResponse = {
  data?: {
    search?: {
      name?: string;
      query?: string;
      mode?: "B2B" | "B2C";
      status?: string;
      retentionDays?: number;
      targetCount?: number;
      chargedCredits?: number;
    };
    job?: { status?: string };
    resultCount?: number;
  };
  meta?: { demo?: boolean };
};
type ResultsResponse =
  | Prospect[]
  | {
      data?: ApiProspect[] | { data?: ApiProspect[] };
      results?: ApiProspect[];
      stats?: {
        totalProspects?: number;
        highQualityProspects?: number;
        averageScore?: number;
      };
      meta?: {
        demo?: boolean;
        maskedContactDetails?: boolean;
        contactDetails?: "masked" | "revealed_and_audited";
        pagination?: { pages?: number; total?: number };
      };
    };

type ContactDetailsStatus =
  "idle" | "loading" | "revealed" | "restricted" | "not_applicable";

export default function SearchResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [demoRun, setDemoRun] = useState(id === "demo-processing");
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState("");
  const [mode, setMode] = useState<ResearchMode>("b2b");
  const [searchName, setSearchName] = useState("");
  const [brief, setBrief] = useState("");
  const [retentionDays, setRetentionDays] = useState(30);
  const [targetCount, setTargetCount] = useState<number | undefined>();
  const [chargedCredits, setChargedCredits] = useState<number | undefined>();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [source, setSource] = useState<"loading" | "live" | "demo" | "error">(
    "loading",
  );
  const [resultsError, setResultsError] = useState("");
  const [contactDetailsStatus, setContactDetailsStatus] =
    useState<ContactDetailsStatus>("idle");
  const [resultStats, setResultStats] = useState({
    totalProspects: 0,
    highQualityProspects: 0,
    averageScore: 0,
  });
  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState("0");
  const [industry, setIndustry] = useState("all");
  const [location, setLocation] = useState("all");
  const [verification, setVerification] = useState("all");
  const [title, setTitle] = useState("");
  const [companySize, setCompanySize] = useState("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [advanced, setAdvanced] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeProspect, setActiveProspect] = useState<Prospect | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const [listOptions, setListOptions] = useState<SavedFolder[]>([]);
  const [targetListId, setTargetListId] = useState("");
  const [listsLoading, setListsLoading] = useState(false);
  const [savingList, setSavingList] = useState(false);
  const [listError, setListError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fallbackMode = params.get("mode") === "B2C" ? "B2C" : "B2B";
    const fallback: SearchMetadataResponse = {
      data: {
        search: {
          name: "Local preview search",
          query: params.get("brief") ?? "Local preview research",
          mode: fallbackMode,
          status: params.get("processing") === "1" ? "PROCESSING" : "COMPLETE",
          retentionDays: Number(params.get("retention") ?? 30),
          targetCount: Number(params.get("target") ?? 100),
        },
        job: {
          status: params.get("processing") === "1" ? "RUNNING" : "COMPLETE",
        },
        resultCount: 0,
      },
      meta: { demo: true },
    };
    let active = true;
    requestOrFallback<SearchMetadataResponse>(
      `/api/search/${encodeURIComponent(id)}`,
      fallback,
    )
      .then(({ data, source: responseSource }) => {
        if (!active) return;
        const search = data.data?.search;
        const status = (
          data.data?.job?.status ??
          search?.status ??
          ""
        ).toUpperCase();
        setMode(search?.mode === "B2C" ? "b2c" : "b2b");
        setSearchName(search?.name ?? "");
        setBrief(search?.query ?? "");
        setRetentionDays(search?.retentionDays ?? 30);
        setTargetCount(search?.targetCount);
        setChargedCredits(
          search?.chargedCredits && search.chargedCredits > 0
            ? search.chargedCredits
            : undefined,
        );
        setDemoRun(responseSource === "demo" || data.meta?.demo === true);
        setProcessing(!["COMPLETE", "PARTIAL"].includes(status));
        setMetadataError("");
      })
      .catch((loadError) => {
        if (active)
          setMetadataError(
            loadError instanceof Error
              ? loadError.message
              : "Search metadata could not be loaded.",
          );
      })
      .finally(() => {
        if (active) setMetadataLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (processing || metadataLoading || metadataError) return;
    let active = true;
    const fallbackProspects =
      mode === "b2c" ? consumerProspects : demoProspects;
    const extractRows = (
      body: ResultsResponse,
    ): Array<ApiProspect | Prospect> => {
      const nestedData =
        !Array.isArray(body) && body.data && !Array.isArray(body.data)
          ? body.data.data
          : undefined;
      return Array.isArray(body)
        ? body
        : Array.isArray(body.data)
          ? body.data
          : (nestedData ?? body.results ?? []);
    };
    const resultsUrl = (page: number, reveal: boolean) =>
      `/api/results?searchId=${encodeURIComponent(id)}&page=${page}&pageSize=100${reveal ? "&reveal=true" : ""}`;
    const loadResults = async () => {
      const revealRequested = mode === "b2b";
      if (active)
        setContactDetailsStatus(revealRequested ? "loading" : "not_applicable");
      let firstResponse: Awaited<
        ReturnType<typeof requestOrFallback<ResultsResponse>>
      >;
      let contactsRevealed = false;
      try {
        firstResponse = await requestOrFallback<ResultsResponse>(
          resultsUrl(1, revealRequested),
          fallbackProspects,
        );
        contactsRevealed =
          revealRequested &&
          firstResponse.source === "live" &&
          !Array.isArray(firstResponse.data) &&
          firstResponse.data.meta?.contactDetails === "revealed_and_audited";
      } catch (error) {
        if (
          revealRequested &&
          error instanceof ApiRequestError &&
          error.status === 403
        ) {
          firstResponse = await requestOrFallback<ResultsResponse>(
            resultsUrl(1, false),
            fallbackProspects,
          );
        } else {
          throw error;
        }
      }
      const { data, source: responseSource } = firstResponse;
      const firstRows = extractRows(data);
      const pages = !Array.isArray(data)
        ? Math.max(1, data.meta?.pagination?.pages ?? 1)
        : 1;
      let allRows = [...firstRows];
      if (responseSource === "live" && pages > 1) {
        const remaining = await Promise.all(
          Array.from({ length: pages - 1 }, async (_, index) => {
            const response = await fetch(
              resultsUrl(index + 2, contactsRevealed),
              { headers: { Accept: "application/json" }, cache: "no-store" },
            );
            const body = (await response
              .json()
              .catch(() => ({}))) as ResultsResponse & {
              error?: { message?: string };
            };
            if (!response.ok)
              throw new Error(
                body.error?.message ??
                  `Result page ${index + 2} failed with ${response.status}.`,
              );
            return extractRows(body);
          }),
        );
        allRows = allRows.concat(...remaining);
      }
      if (!active) return;
      const result = allRows.map((item) =>
        "decisionConfidence" in item
          ? (item as unknown as Prospect)
          : prospectFromApi(item, mode),
      );
      const resolved =
        responseSource === "demo" && !result.length
          ? fallbackProspects
          : result;
      const apiStats = !Array.isArray(data) ? data.stats : undefined;
      setProspects(resolved);
      setResultStats({
        totalProspects: apiStats?.totalProspects ?? resolved.length,
        highQualityProspects:
          apiStats?.highQualityProspects ??
          resolved.filter((item) => item.score >= 80).length,
        averageScore:
          apiStats?.averageScore ??
          (resolved.length
            ? Math.round(
                resolved.reduce((sum, item) => sum + item.score, 0) /
                  resolved.length,
              )
            : 0),
      });
      setSource(
        responseSource === "demo" || (!Array.isArray(data) && data.meta?.demo)
          ? "demo"
          : "live",
      );
      setContactDetailsStatus(
        mode === "b2c"
          ? "not_applicable"
          : contactsRevealed
            ? "revealed"
            : "restricted",
      );
      setResultsError("");
    };
    void loadResults().catch((loadError) => {
      if (active) {
        setProspects([]);
        setResultStats({
          totalProspects: 0,
          highQualityProspects: 0,
          averageScore: 0,
        });
        setSource("error");
        setContactDetailsStatus(
          mode === "b2c" ? "not_applicable" : "restricted",
        );
        setResultsError(
          loadError instanceof Error
            ? loadError.message
            : "Results could not be loaded.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [id, metadataError, metadataLoading, mode, processing]);

  const finishProcessing = useCallback(() => setProcessing(false), []);
  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    const items = prospects.filter((prospect) => {
      const matchesText =
        !normalized ||
        `${prospect.name} ${prospect.title} ${prospect.company} ${prospect.industry} ${prospect.location}`
          .toLowerCase()
          .includes(normalized);
      const matchesTitle =
        !title || prospect.title.toLowerCase().includes(title.toLowerCase());
      return (
        matchesText &&
        matchesTitle &&
        prospect.score >= Number(minScore) &&
        (industry === "all" || prospect.industry === industry) &&
        (location === "all" || prospect.location.includes(location)) &&
        (verification === "all" || prospect.status === verification) &&
        (companySize === "all" || prospect.companySize === companySize)
      );
    });
    return [...items].sort((a, b) =>
      sort === "score"
        ? b.score - a.score
        : sort === "company"
          ? a.company.localeCompare(b.company)
          : sort === "location"
            ? a.location.localeCompare(b.location)
            : b.id.localeCompare(a.id),
    );
  }, [
    companySize,
    industry,
    location,
    minScore,
    prospects,
    query,
    sort,
    title,
    verification,
  ]);

  const industries = [...new Set(prospects.map((item) => item.industry))];
  const locations = [
    ...new Set(prospects.map((item) => item.location.split(",")[0])),
  ];
  const activeFilters =
    Number(minScore) > 0 ||
    industry !== "all" ||
    location !== "all" ||
    verification !== "all" ||
    title ||
    companySize !== "all";
  const resetFilters = () => {
    setQuery("");
    setMinScore("0");
    setIndustry("all");
    setLocation("all");
    setVerification("all");
    setTitle("");
    setCompanySize("all");
  };
  const average = resultStats.averageScore;

  const openListPicker = async () => {
    setListPickerOpen(true);
    setListsLoading(true);
    setListError("");
    try {
      const { data, source: responseSource } = await requestOrFallback<{
        data?: unknown[];
      }>("/api/lists", { data: savedFolders });
      const rows = Array.isArray(data.data)
        ? data.data.map((item) =>
            "prospectIds" in (item as object)
              ? (item as SavedFolder)
              : listFromApi(item as Parameters<typeof listFromApi>[0]),
          )
        : responseSource === "demo"
          ? savedFolders
          : [];
      setListOptions(rows);
      setTargetListId(rows[0]?.id ?? "");
    } catch (pickerError) {
      setListOptions([]);
      setListError(
        pickerError instanceof Error
          ? pickerError.message
          : "Lists could not be loaded.",
      );
    } finally {
      setListsLoading(false);
    }
  };

  const addSelectionToList = async () => {
    if (!targetListId || !selected.size) return;
    setSavingList(true);
    setListError("");
    try {
      await requestOrFallback(
        `/api/lists/${encodeURIComponent(targetListId)}`,
        { data: { ok: true } },
        {
          method: "PATCH",
          body: JSON.stringify({ addResultIds: [...selected] }),
        },
      );
      const listName =
        listOptions.find((item) => item.id === targetListId)?.name ??
        "the selected list";
      setBulkMessage(
        `${selected.size} prospect${selected.size === 1 ? "" : "s"} added to ${listName}`,
      );
      setSelected(new Set());
      setListPickerOpen(false);
    } catch (saveError) {
      setListError(
        saveError instanceof Error
          ? saveError.message
          : "The records could not be added to this list.",
      );
    } finally {
      setSavingList(false);
    }
  };

  if (metadataLoading)
    return (
      <Surface>
        <EmptyState
          icon={<Search className="size-5" />}
          title="Loading search"
          description="Fetching the authoritative search mode, status, scope, and job state."
        />
      </Surface>
    );
  if (metadataError)
    return (
      <Surface>
        <EmptyState
          icon={<X className="size-5" />}
          title="Search unavailable"
          description={metadataError}
          action={
            <Button variant="secondary" onClick={() => router.push("/search")}>
              Return to search
            </Button>
          }
        />
      </Surface>
    );

  if (processing) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Research in progress"
          description={brief || "Research job"}
          meta={
            <>
              <StatusBadge tone="warning">
                {demoRun ? "Preview job" : "Live job"}
              </StatusBadge>
              <span>{mode.toUpperCase()} · status refreshes automatically</span>
            </>
          }
        />
        <SearchProgress
          searchId={id}
          demo={demoRun}
          onComplete={finishProcessing}
          onReveal={finishProcessing}
          mode={mode}
          brief={brief}
          retentionDays={retentionDays}
          targetCount={targetCount}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          searchName ||
          brief ||
          (mode === "b2c"
            ? "Consumer audience research"
            : "Business prospect research")
        }
        description={
          brief ||
          (mode === "b2c"
            ? "Recorded first-party or reviewed-partner audience. Each record still requires a current purpose, permission, expiry, retention, and suppression check before use."
            : "20–200 employees, active sales hiring, India. AI score favors source-supported decision-maker likelihood, company fit, and recent growth signals.")
        }
        meta={
          <>
            <StatusBadge
              tone={
                source === "error"
                  ? "danger"
                  : source === "loading"
                    ? "neutral"
                    : "success"
              }
            >
              {source !== "error" ? <Check className="size-3" /> : null}
              {source === "loading"
                ? "Loading"
                : source === "error"
                  ? "Unavailable"
                  : "Complete"}
            </StatusBadge>
            <StatusBadge tone={mode === "b2c" ? "warning" : "neutral"}>
              {mode.toUpperCase()}
            </StatusBadge>
            <span>
              Search {id.slice(0, 12)} ·{" "}
              {source === "live"
                ? "Live data"
                : source === "demo"
                  ? "Preview data"
                  : source === "loading"
                    ? "Loading records"
                    : "No fallback data shown"}
            </span>
          </>
        }
        action={
          <>
            <Button variant="secondary" onClick={() => router.push("/search")}>
              <RotateCcw className="size-4" />
              Search again
            </Button>
            <Button
              disabled={
                source === "loading" || source === "error" || !prospects.length
              }
              onClick={() => setExportOpen(true)}
            >
              <Download className="size-4" />
              Export
            </Button>
          </>
        }
      />

      {resultsError ? (
        <InlineNotice title="Results unavailable" tone="danger">
          <p>{resultsError}</p>
        </InlineNotice>
      ) : null}
      {source === "live" || source === "demo" ? (
        <CompletedRunSummary
          mode={mode}
          count={resultStats.totalProspects}
          chargedCredits={chargedCredits}
          targetCount={targetCount}
        />
      ) : null}

      <section
        aria-label="Result summary"
        className="grid divide-y divide-zinc-200 border-y border-zinc-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-zinc-800 dark:border-zinc-800"
      >
        {[
          [
            mode === "b2c" ? "Audience records" : "Total prospects",
            resultStats.totalProspects.toString(),
            "Non-duplicate records",
          ],
          [
            mode === "b2c" ? "High relevance" : "High quality",
            resultStats.highQualityProspects.toString(),
            "Score 80 or above",
          ],
          [
            mode === "b2c" ? "Average relevance" : "Average score",
            average.toString(),
            "Across all results",
          ],
          [
            mode === "b2c"
              ? "Current permission checks"
              : "Needs verification review",
            mode === "b2c"
              ? "0"
              : prospects
                  .filter((item) => item.status === "Review")
                  .length.toString(),
            mode === "b2c"
              ? "Open each record to verify"
              : "LIKELY records awaiting a verifier",
          ],
        ].map(([label, value, note]) => (
          <div key={label} className="px-1 py-4 sm:px-5 first:pl-1">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{label}</p>
            <p className="tabular-nums mt-1 text-2xl font-semibold tracking-[-0.03em]">
              {value}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">{note}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="prospects-heading" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div>
            <h2
              id="prospects-heading"
              className="text-base font-semibold text-zinc-950 dark:text-white"
            >
              {mode === "b2c" ? "Recorded audience" : "Prospects"}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {filtered.length} of {prospects.length} visible
            </p>
          </div>
          <div className="flex-1" />
          <label className="relative block min-w-0 lg:w-64">
            <span className="sr-only">Search result records</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search records…"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-blue-400"
            />
          </label>
          <label className="block">
            <span className="sr-only">Sort prospects</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-blue-400"
            >
              <option value="score">Highest score</option>
              <option value="newest">Newest</option>
              {mode === "b2b" ? <option value="company">Company</option> : null}
              <option value="location">Location</option>
            </select>
          </label>
          <Button
            variant="secondary"
            onClick={() => setAdvanced((value) => !value)}
            aria-expanded={advanced}
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {activeFilters ? (
              <span
                className="size-2 rounded-full bg-blue-500"
                aria-label="Filters applied"
              />
            ) : null}
            <ChevronDown
              className={`size-3.5 transition-transform motion-reduce:transition-none ${advanced ? "rotate-180" : ""}`}
            />
          </Button>
        </div>

        {advanced ? (
          <Surface className="p-4">
            <div
              className={`grid gap-4 sm:grid-cols-2 ${mode === "b2b" ? "lg:grid-cols-6" : "lg:grid-cols-2"}`}
            >
              <SelectField
                label={mode === "b2c" ? "Minimum relevance" : "Minimum score"}
                value={minScore}
                onChange={(event) => setMinScore(event.target.value)}
              >
                <option value="0">Any score</option>
                <option value="65">65+</option>
                <option value="75">75+</option>
                <option value="80">80+</option>
                <option value="90">90+</option>
              </SelectField>
              {mode === "b2b" ? (
                <SelectField
                  label="Industry"
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                >
                  <option value="all">All industries</option>
                  {industries.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </SelectField>
              ) : null}
              <SelectField
                label="Location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              >
                <option value="all">All locations</option>
                {locations.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </SelectField>
              {mode === "b2b" ? (
                <SelectField
                  label="Verification"
                  value={verification}
                  onChange={(event) => setVerification(event.target.value)}
                >
                  <option value="all">Any status</option>
                  <option>Verified</option>
                  <option>Review</option>
                  <option>Limited</option>
                </SelectField>
              ) : null}
              {mode === "b2b" ? (
                <>
                  <SelectField
                    label="Company size"
                    value={companySize}
                    onChange={(event) => setCompanySize(event.target.value)}
                  >
                    <option value="all">Any size</option>
                    {[
                      ...new Set(prospects.map((item) => item.companySize)),
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </SelectField>
                  <Field
                    label="Title contains"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Founder, VP…"
                  />
                </>
              ) : null}
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="size-3.5" />
                Clear filters
              </Button>
            </div>
          </Surface>
        ) : null}

        {selected.size ? (
          <div className="flex flex-col gap-3 rounded-xl bg-zinc-950 px-4 py-3 text-white sm:flex-row sm:items-center dark:bg-zinc-100 dark:text-zinc-950">
            <p className="text-sm font-medium">
              <span className="tabular-nums">{selected.size}</span> selected
            </p>
            <div className="sm:ml-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-white"
                onClick={() => void openListPicker()}
              >
                <ListPlus className="size-3.5" />
                Add to list
              </Button>
              <Button
                size="sm"
                className="bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-white"
                onClick={() => setExportOpen(true)}
              >
                <Download className="size-3.5" />
                Export selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-zinc-300 hover:bg-zinc-800 hover:text-white dark:text-zinc-700 dark:hover:bg-zinc-200 dark:hover:text-zinc-950"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        ) : null}
        {bulkMessage ? (
          <div
            role="status"
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          >
            <span className="inline-flex items-center gap-2">
              <Check className="size-3.5" />
              {bulkMessage}
            </span>
            <button
              onClick={() => setBulkMessage("")}
              aria-label="Dismiss message"
              className="flex size-9 items-center justify-center rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        {filtered.length ? (
          <ProspectTable
            prospects={filtered}
            selected={selected}
            onSelectionChange={setSelected}
            onOpen={setActiveProspect}
            mode={mode}
            contactDetailsStatus={contactDetailsStatus}
          />
        ) : (
          <Surface>
            <EmptyState
              icon={<Filter className="size-5" />}
              title={
                source === "loading"
                  ? "Loading results"
                  : source === "error"
                    ? "Results are unavailable"
                    : activeFilters
                      ? "No prospects match these filters"
                      : "No eligible prospects were stored"
              }
              description={
                source === "error"
                  ? "Athreix did not substitute preview records for this failed live request."
                  : activeFilters
                    ? "Clear one or more filters, lower the score threshold, or start another search with a broader brief."
                    : "Try a broader brief or review the search job for exclusions and compliance blocks."
              }
              action={
                activeFilters ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </Surface>
        )}
        <p className="text-xs leading-5 text-zinc-500">
          {mode === "b2c"
            ? "Relevance never replaces permission. Open each record to confirm consent, provenance, suppression status, purpose, and retention before any individual use."
            : "AI scores guide review; they do not guarantee fit, accuracy, or permission to contact. Open a record to inspect evidence, confidence, provenance, and freshness."}
        </p>
      </section>

      <LeadDrawer
        prospect={activeProspect}
        open={Boolean(activeProspect)}
        contactDetailsRevealed={
          contactDetailsStatus === "revealed" &&
          activeProspect?.status !== "Limited"
        }
        onOpenChange={(open) => {
          if (!open) setActiveProspect(null);
        }}
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        selectedCount={selected.size}
        selectedIds={[...selected]}
        consumerData={mode === "b2c"}
        searchId={id}
      />
      <Dialog.Root open={listPickerOpen} onOpenChange={setListPickerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.22)] outline-none dark:bg-zinc-950">
            <Dialog.Title className="text-base font-semibold text-zinc-950 dark:text-white">
              Add to saved list
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Choose where to save {selected.size} selected prospect
              {selected.size === 1 ? "" : "s"}.
            </Dialog.Description>
            {listsLoading ? (
              <p className="mt-5 text-sm text-zinc-500">Loading lists…</p>
            ) : listOptions.length ? (
              <SelectField
                className="mt-5"
                label="Destination list"
                value={targetListId}
                onChange={(event) => setTargetListId(event.target.value)}
              >
                {listOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.count})
                  </option>
                ))}
              </SelectField>
            ) : (
              <EmptyState
                icon={<ListPlus className="size-5" />}
                title="No saved lists"
                description="Create a list first, then return to add these records."
                action={
                  <Button onClick={() => router.push("/lists")}>
                    Create a list
                  </Button>
                }
              />
            )}
            {listError ? (
              <p
                role="alert"
                className="mt-3 text-xs leading-5 text-red-700 dark:text-red-300"
              >
                {listError}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="ghost">Cancel</Button>
              </Dialog.Close>
              {listOptions.length ? (
                <Button
                  loading={savingList}
                  disabled={!targetListId}
                  onClick={() => void addSelectionToList()}
                >
                  Add to list
                </Button>
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
