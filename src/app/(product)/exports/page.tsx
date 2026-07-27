"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock3,
  Download,
  FileArchive,
  FileJson2,
  FileSpreadsheet,
  FolderOpen,
  History,
  RotateCcw,
  Search,
  ShieldCheck,
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
import {
  exports as demoExports,
  savedFolders as demoSavedFolders,
} from "@/lib/demo/data";
import { exportFromApi, listFromApi } from "@/lib/demo/adapters";
import type { ExportRecord, SavedFolder } from "@/lib/demo/types";

type ExportListResponse = { data?: unknown[]; meta?: { demo?: boolean } };

type SearchHistoryItem = {
  id: string;
  name: string;
  query: string;
  mode: "B2B" | "B2C";
  status: "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED";
  resultCount?: number;
  exportableResultCount?: number;
  chargedCredits?: number;
  retentionUntil: string;
  createdAt: string;
  _count?: { results?: number };
};

type HistoryResponse = {
  data?: SearchHistoryItem[];
  meta?: {
    pagination?: {
      pages?: number;
    };
  };
};

type ListResponse = { data?: unknown[] };
type SourceKind = "search" | "list";
type ExportFormat = ExportRecord["format"];

const exportFormats: Array<{
  value: ExportFormat;
  label: string;
  detail: string;
}> = [
  { value: "CSV", label: "CSV", detail: "Spreadsheet rows" },
  { value: "XLSX", label: "Excel", detail: "Formatted workbook" },
  { value: "JSON", label: "JSON", detail: "Structured data" },
  { value: "PDF", label: "PDF", detail: "Readable report" },
  { value: "CRM", label: "CRM", detail: "Import-ready CSV" },
  { value: "AI_REPORT", label: "AI report", detail: "Executive PDF" },
];

const exportExtensions: Record<ExportFormat, string> = {
  CSV: "csv",
  XLSX: "xlsx",
  JSON: "json",
  PDF: "pdf",
  CRM: "csv",
  AI_REPORT: "pdf",
};

function searchResultCount(item: SearchHistoryItem) {
  return item.resultCount ?? item._count?.results ?? item.chargedCredits ?? 0;
}

function exportableSearchResultCount(item: SearchHistoryItem) {
  return item.exportableResultCount ?? searchResultCount(item);
}

function searchIsExportable(item: SearchHistoryItem) {
  return (
    item.status === "COMPLETE" &&
    exportableSearchResultCount(item) > 0 &&
    new Date(item.retentionUntil) > new Date()
  );
}

function responseFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}

function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    message?: string;
  };
  return (
    payload.error?.message ??
    payload.message ??
    `Export blocked with status ${response.status}.`
  );
}

export default function ExportsPage() {
  const router = useRouter();
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [savedLists, setSavedLists] = useState<SavedFolder[]>([]);
  const [sourceKind, setSourceKind] = useState<SourceKind>("search");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [format, setFormat] = useState<ExportFormat>("CSV");
  const [lawfulUseAccepted, setLawfulUseAccepted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sourcesStatus, setSourcesStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [source, setSource] = useState<"loading" | "live" | "demo" | "error">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    requestOrFallback<ExportListResponse>("/api/exports", {
      data: demoExports,
      meta: { demo: true },
    })
      .then(({ data, source: responseSource }) => {
        if (!active) return;
        const rows = Array.isArray(data.data)
          ? data.data.map((item) =>
              "createdBy" in (item as object)
                ? (item as ExportRecord)
                : exportFromApi(item as Parameters<typeof exportFromApi>[0]),
            )
          : [];
        setExports(rows);
        setSource(
          responseSource === "demo" || data.meta?.demo ? "demo" : "live",
        );
      })
      .catch(() => {
        if (!active) return;
        setExports([]);
        setSource("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadSources = async () => {
      const historyPromise = (async () => {
        const rows: SearchHistoryItem[] = [];
        let page = 1;
        let pages = 1;
        do {
          const response = await requestOrFallback<HistoryResponse>(
            `/api/history?page=${page}&pageSize=100`,
            {
              data: [],
              meta: { pagination: { pages: 1 } },
            },
          );
          rows.push(...(response.data.data ?? []));
          pages = Math.max(page, response.data.meta?.pagination?.pages ?? page);
          page += 1;
        } while (page <= pages);
        return rows;
      })();
      const listsPromise = requestOrFallback<ListResponse>("/api/lists", {
        data: demoSavedFolders,
      });
      const [historyRows, listsResponse] = await Promise.all([
        historyPromise,
        listsPromise,
      ]);
      if (!active) return;

      const listRows = Array.isArray(listsResponse.data.data)
        ? listsResponse.data.data.map((item) =>
            "shared" in (item as object)
              ? (item as SavedFolder)
              : listFromApi(item as Parameters<typeof listFromApi>[0]),
          )
        : [];
      setSearchHistory(historyRows);
      setSavedLists(listRows);

      const params = new URLSearchParams(window.location.search);
      const requestedSearchId = params.get("searchId");
      const requestedListId = params.get("listId");
      const requestedSearch = historyRows.find(
        (item) => item.id === requestedSearchId && searchIsExportable(item),
      );
      const requestedList = listRows.find(
        (item) => item.id === requestedListId && item.count > 0,
      );
      const firstSearch = historyRows.find(searchIsExportable);
      const firstList = listRows.find((item) => item.count > 0);

      if (requestedSearch) {
        setSourceKind("search");
        setSelectedSourceId(requestedSearch.id);
      } else if (requestedList) {
        setSourceKind("list");
        setSelectedSourceId(requestedList.id);
      } else if (firstSearch) {
        setSourceKind("search");
        setSelectedSourceId(firstSearch.id);
      } else if (firstList) {
        setSourceKind("list");
        setSelectedSourceId(firstList.id);
      }
      setSourcesStatus("ready");
    };

    loadSources().catch(() => {
      if (active) {
        setSearchHistory([]);
        setSavedLists([]);
        setSourcesStatus("error");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const sourceNames = useMemo(
    () =>
      new Map([
        ...searchHistory.map(
          (item) => [item.id, item.name || item.query] as const,
        ),
        ...savedLists.map((item) => [item.id, item.name] as const),
      ]),
    [savedLists, searchHistory],
  );

  const filtered = useMemo(
    () =>
      exports.filter(
        (item) =>
          (status === "all" || item.status === status) &&
          `${sourceNames.get(item.searchId ?? item.listId ?? "") ?? item.name} ${item.format} ${item.scope}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [exports, query, sourceNames, status],
  );

  const selectedSearch =
    sourceKind === "search"
      ? searchHistory.find((item) => item.id === selectedSourceId)
      : undefined;
  const selectedList =
    sourceKind === "list"
      ? savedLists.find((item) => item.id === selectedSourceId)
      : undefined;
  const selectedSourceName =
    selectedSearch?.name || selectedSearch?.query || selectedList?.name;

  const chooseSourceKind = (kind: SourceKind) => {
    setSourceKind(kind);
    setSelectedSourceId(
      kind === "search"
        ? (searchHistory.find(searchIsExportable)?.id ?? "")
        : (savedLists.find((item) => item.count > 0)?.id ?? ""),
    );
  };

  const createExport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sourceAvailable =
      sourceKind === "search"
        ? Boolean(selectedSearch && searchIsExportable(selectedSearch))
        : Boolean(selectedList && selectedList.count > 0);
    if (!selectedSourceId || !sourceAvailable) {
      setError("Choose a completed search or a saved list with records.");
      return;
    }
    if (!lawfulUseAccepted) {
      setError("Confirm lawful use before creating the export.");
      return;
    }

    setCreating(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `export-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          ...(sourceKind === "search"
            ? { searchId: selectedSourceId }
            : { listId: selectedSourceId }),
          format,
          onlyVerified: false,
          acknowledgeLawfulUse: true,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));

      const blob = await response.blob();
      const filename = responseFilename(
        response,
        `athreix-export.${exportExtensions[format]}`,
      );
      const recordCount = Number(
        response.headers.get("x-athreix-record-count") ?? 0,
      );
      const exportId =
        response.headers.get("x-athreix-export-id") ??
        `export-${crypto.randomUUID()}`;
      saveFile(blob, filename);
      setExports((current) => [
        {
          id: exportId,
          searchId: sourceKind === "search" ? selectedSourceId : undefined,
          listId: sourceKind === "list" ? selectedSourceId : undefined,
          name: selectedSourceName
            ? `${selectedSourceName} · export`
            : "Prospect export",
          format,
          records: Number.isFinite(recordCount) ? recordCount : 0,
          status: "Ready",
          createdAt: "Just now",
          scope: "All permitted fields",
          createdBy: "Workspace",
        },
        ...current.filter((item) => item.id !== exportId),
      ]);
      setLawfulUseAccepted(false);
      setNotice(
        `Downloaded ${recordCount} ${recordCount === 1 ? "record" : "records"} as ${format}. The run was added to export history.`,
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "The export could not be created.",
      );
    } finally {
      setCreating(false);
    }
  };

  const download = async (item: ExportRecord) => {
    const itemName =
      sourceNames.get(item.searchId ?? item.listId ?? "") ?? item.name;
    setDownloadingId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/exports/${encodeURIComponent(item.id)}/download`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(await responseError(response));
      }
      const blob = await response.blob();
      saveFile(
        blob,
        `${
          itemName
            .toLowerCase()
            .replaceAll(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "athreix-export"
        }.${exportExtensions[item.format]}`,
      );
      setNotice(`Downloaded ${itemName}`);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "This export is not available for download.",
      );
    } finally {
      setDownloadingId("");
    }
  };

  const readyCount = exports.filter((item) => item.status === "Ready").length;
  const preparingCount = exports.filter(
    (item) => item.status === "Preparing",
  ).length;
  const expiredCount = exports.filter(
    (item) => item.status === "Expired",
  ).length;
  const recordCount = exports.reduce((sum, item) => sum + item.records, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exports"
        description="Choose any retained search or saved list, select a file format, and download an audited export."
        meta={
          <StatusBadge tone={source === "error" ? "danger" : "neutral"}>
            {source === "loading"
              ? "Loading"
              : source === "demo"
                ? "Preview history"
                : source === "live"
                  ? "Live history"
                  : "Unavailable"}
          </StatusBadge>
        }
        action={
          <Button
            onClick={() =>
              document
                .getElementById("create-export")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            <Download className="size-4" />
            Create export
          </Button>
        }
      />
      {notice ? (
        <div
          role="status"
          className="flex min-h-11 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          <Check className="size-3.5" />
          {notice}
        </div>
      ) : null}
      {error ? (
        <InlineNotice title="Export unavailable" tone="danger">
          <p>{error}</p>
        </InlineNotice>
      ) : null}

      <Surface id="create-export" className="scroll-mt-6 overflow-hidden">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
                Create an export
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Pick a run from search history or use any saved list.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => router.push("/history")}
            >
              <History className="size-3.5" />
              Full search history
            </Button>
          </div>
        </div>

        <form
          onSubmit={(event) => void createExport(event)}
          className="grid gap-0 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]"
        >
          <div className="border-b border-zinc-200 p-5 xl:border-b-0 xl:border-r dark:border-zinc-800">
            <fieldset>
              <legend className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                1. Choose records
              </legend>
              <div className="mt-3 grid grid-cols-2 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
                {(
                  [
                    ["search", "Search history", Search],
                    ["list", "Saved lists", FolderOpen],
                  ] as const
                ).map(([kind, label, Icon]) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={sourceKind === kind}
                    onClick={() => chooseSourceKind(kind)}
                    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      sourceKind === kind
                        ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white"
                        : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              <div
                role="radiogroup"
                aria-label={
                  sourceKind === "search" ? "Search history" : "Saved lists"
                }
                className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800"
              >
                {sourcesStatus === "loading" ? (
                  <p
                    role="status"
                    className="flex min-h-28 items-center justify-center px-4 text-xs text-zinc-500"
                  >
                    Loading searches and lists…
                  </p>
                ) : sourcesStatus === "error" ? (
                  <p className="flex min-h-28 items-center justify-center px-4 text-center text-xs text-red-600 dark:text-red-400">
                    Searches and lists could not be loaded.
                  </p>
                ) : sourceKind === "search" ? (
                  searchHistory.length ? (
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {searchHistory.map((item) => {
                        const available = searchIsExportable(item);
                        const count = exportableSearchResultCount(item);
                        return (
                          <label
                            key={item.id}
                            className={`flex gap-3 p-3 transition-colors ${
                              available
                                ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                                : "cursor-not-allowed opacity-55"
                            } ${
                              selectedSourceId === item.id
                                ? "bg-blue-50/70 dark:bg-blue-950/20"
                                : ""
                            }`}
                          >
                            <input
                              type="radio"
                              name="export-source"
                              value={item.id}
                              checked={
                                sourceKind === "search" &&
                                selectedSourceId === item.id
                              }
                              disabled={!available}
                              onChange={() => setSelectedSourceId(item.id)}
                              className="mt-1 size-4 shrink-0 accent-blue-600"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center justify-between gap-2">
                                <span className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                                  {item.name || item.query}
                                </span>
                                <span className="shrink-0 text-[11px] text-zinc-500">
                                  {count} {count === 1 ? "record" : "records"}
                                </span>
                              </span>
                              <span className="mt-1 block truncate text-xs text-zinc-500">
                                {item.query ||
                                  "Search details expired under retention"}
                              </span>
                              <span className="mt-1.5 block text-[11px] text-zinc-500">
                                {item.status.toLowerCase()} ·{" "}
                                {new Date(item.createdAt).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                                {!available ? " · unavailable for export" : ""}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex min-h-32 flex-col items-center justify-center gap-3 px-4 text-center">
                      <p className="text-xs text-zinc-500">
                        No search history yet. Run a search and it will appear
                        here automatically.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => router.push("/search")}
                      >
                        New search
                      </Button>
                    </div>
                  )
                ) : savedLists.length ? (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {savedLists.map((item) => {
                      const available = item.count > 0;
                      return (
                        <label
                          key={item.id}
                          className={`flex gap-3 p-3 transition-colors ${
                            available
                              ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                              : "cursor-not-allowed opacity-55"
                          } ${
                            selectedSourceId === item.id
                              ? "bg-blue-50/70 dark:bg-blue-950/20"
                              : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="export-source"
                            value={item.id}
                            checked={
                              sourceKind === "list" &&
                              selectedSourceId === item.id
                            }
                            disabled={!available}
                            onChange={() => setSelectedSourceId(item.id)}
                            className="mt-1 size-4 shrink-0 accent-blue-600"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                                {item.name}
                              </span>
                              <span className="shrink-0 text-[11px] text-zinc-500">
                                {item.count}{" "}
                                {item.count === 1 ? "record" : "records"}
                              </span>
                            </span>
                            <span className="mt-1 block truncate text-xs text-zinc-500">
                              {item.description}
                            </span>
                            {!available ? (
                              <span className="mt-1.5 block text-[11px] text-zinc-500">
                                Empty list · unavailable for export
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-32 flex-col items-center justify-center gap-3 px-4 text-center">
                    <p className="text-xs text-zinc-500">
                      No saved lists yet. Save records from a completed search
                      first.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => router.push("/lists")}
                    >
                      Open lists
                    </Button>
                  </div>
                )}
              </div>
            </fieldset>
          </div>

          <div className="flex flex-col p-5">
            <fieldset>
              <legend className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                2. Choose file type
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                {exportFormats.map((option) => (
                  <label key={option.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="export-format"
                      value={option.value}
                      checked={format === option.value}
                      onChange={() => setFormat(option.value)}
                      className="peer sr-only"
                    />
                    <span className="block min-h-16 rounded-lg border border-zinc-200 p-3 outline-none transition-colors peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 dark:border-zinc-800 dark:peer-checked:border-blue-500 dark:peer-checked:bg-blue-950/30">
                      <span className="block text-xs font-semibold text-zinc-950 dark:text-white">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-[11px] text-zinc-500">
                        {option.detail}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/70">
              <input
                type="checkbox"
                checked={lawfulUseAccepted}
                onChange={(event) => setLawfulUseAccepted(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-blue-600"
              />
              <span className="text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                I confirm this export is for the documented lawful purpose and I
                will honor suppression, deletion, and retention requirements.
              </span>
            </label>

            <div className="mt-auto pt-5">
              <Button
                type="submit"
                className="w-full"
                loading={creating}
                disabled={creating || !selectedSourceId || !lawfulUseAccepted}
              >
                <Download className="size-4" />
                Download {format}
              </Button>
              <p className="mt-2 text-center text-[11px] text-zinc-500">
                {selectedSourceName
                  ? `Source: ${selectedSourceName}`
                  : "Choose a source to continue"}
              </p>
            </div>
          </div>
        </form>
      </Surface>

      <section
        aria-label="Export summary"
        className="grid divide-y divide-zinc-200 border-y border-zinc-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-zinc-800 dark:border-zinc-800"
      >
        {[
          ["Ready files", readyCount, "Available now"],
          ["Records exported", recordCount, "Across retained history"],
          ["Preparing", preparingCount, "Awaiting storage"],
          ["Expired", expiredCount, "Create again from source search"],
        ].map(([label, value, note]) => (
          <div key={String(label)} className="px-1 py-4 sm:px-5 first:pl-1">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{label}</p>
            <p className="tabular-nums mt-1 text-xl font-semibold tracking-[-0.02em]">
              {value}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">{note}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-labelledby="export-history-heading" className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="export-history-heading"
                className="text-base font-semibold text-zinc-950 dark:text-white"
              >
                Export history
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Files created by this workspace
              </p>
            </div>
            <div className="flex gap-2">
              <label className="relative min-w-0">
                <span className="sr-only">Search exports</span>
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search exports…"
                  className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-white"
                />
              </label>
              <label>
                <span className="sr-only">Filter export status</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-white"
                >
                  <option value="all">All statuses</option>
                  <option>Ready</option>
                  <option>Preparing</option>
                  <option>Expired</option>
                </select>
              </label>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            {filtered.length ? (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filtered.map((item) => {
                  const itemName =
                    sourceNames.get(item.searchId ?? item.listId ?? "") ??
                    item.name;
                  return (
                    <article
                      key={item.id}
                      className="flex flex-col gap-4 p-4 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center dark:hover:bg-zinc-900/60"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {item.format === "JSON" ? (
                          <FileJson2 className="size-4" />
                        ) : (
                          <FileSpreadsheet className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                            {itemName}
                          </h3>
                          <StatusBadge
                            tone={
                              item.status === "Ready"
                                ? "success"
                                : item.status === "Preparing"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {item.status}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {item.records} records · {item.format} · {item.scope}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {item.createdAt} by {item.createdBy}
                        </p>
                      </div>
                      <div className="flex gap-1 self-end sm:self-auto">
                        {item.status === "Ready" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={downloadingId === item.id}
                            onClick={() => void download(item)}
                          >
                            <Download className="size-3.5" />
                            Download
                          </Button>
                        ) : item.status === "Expired" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              router.push(
                                item.searchId
                                  ? `/search/${item.searchId}`
                                  : item.listId
                                    ? "/lists"
                                    : "/search",
                              )
                            }
                          >
                            <RotateCcw className="size-3.5" />
                            Open source
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" disabled>
                            <Clock3 className="size-3.5" />
                            Preparing
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<FileArchive className="size-5" />}
                title={
                  source === "loading"
                    ? "Loading export history"
                    : "No exports found"
                }
                description={
                  query || status !== "all"
                    ? "Change the search or status filter."
                    : "Create an export from an authorized prospect search; retained files will appear here."
                }
                action={
                  source !== "loading" ? (
                    <Button
                      onClick={() =>
                        document
                          .getElementById("create-export")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          })
                      }
                    >
                      Create export
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <Surface className="p-5">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
              How to create an export
            </h2>
            <ol className="mt-4 space-y-3 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
              <li>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  1.
                </span>{" "}
                Choose a completed run from search history or a saved list.
              </li>
              <li>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  2.
                </span>{" "}
                Select the file type that fits your workflow.
              </li>
              <li>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  3.
                </span>{" "}
                Confirm lawful use and download the audited file.
              </li>
            </ol>
          </Surface>
          <InlineNotice
            title="Responsible data handling"
            icon={<ShieldCheck className="size-4" />}
          >
            <p>
              Downloaded files leave Athreix controls. Store them securely,
              restrict access, honor deletion and suppression requests, and
              remove them when the documented purpose ends.
            </p>
          </InlineNotice>
        </aside>
      </div>
    </div>
  );
}
