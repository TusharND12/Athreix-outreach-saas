"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Check,
  Circle,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { jobStages } from "@/lib/demo/data";
import type { ResearchMode } from "@/lib/demo/types";
import { Button, StatusBadge, Surface, cx } from "./ui";

export function SearchProgress({
  searchId,
  demo = false,
  onComplete,
  onReveal,
  mode = "b2b",
  brief,
  retentionDays = 30,
  targetCount,
}: {
  searchId: string;
  demo?: boolean;
  onComplete: () => void;
  onReveal: () => void;
  mode?: ResearchMode;
  brief?: string;
  retentionDays?: number;
  targetCount?: number;
}) {
  const [activeStage, setActiveStage] = useState(0);
  const [records, setRecords] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [serverProgress, setServerProgress] = useState<number | null>(null);
  const [failure, setFailure] = useState("");
  const [pollNonce, setPollNonce] = useState(0);

  useEffect(() => {
    const elapsedTimer = window.setInterval(
      () => setElapsed((current) => current + 1),
      1000,
    );
    if (!demo) return () => window.clearInterval(elapsedTimer);
    const stageTimer = window.setInterval(() => {
      setActiveStage((current) => {
        if (current >= jobStages.length - 1) {
          window.clearInterval(stageTimer);
          window.setTimeout(onComplete, 650);
          return current;
        }
        return current + 1;
      });
    }, 1200);
    const countTimer = window.setInterval(
      () => setRecords((current) => Math.min(targetCount ?? 25, current + 17)),
      340,
    );
    return () => {
      window.clearInterval(stageTimer);
      window.clearInterval(countTimer);
      window.clearInterval(elapsedTimer);
    };
  }, [demo, onComplete, targetCount]);

  useEffect(() => {
    if (demo) return;
    let active = true;
    let timer: number | undefined;
    let eventSource: EventSource | undefined;
    let polling = false;
    let finished = false;
    type ProgressPayload = {
      search?: { status?: string };
      job?: { status?: string; stage?: string; progress?: number };
      resultCount?: number;
    };
    const stageIndex = (stage?: string, progress?: number) => {
      const normalized = stage?.toUpperCase() ?? "";
      if (normalized.includes("COMPLETE")) return jobStages.length - 1;
      if (normalized.includes("OUTREACH")) return 10;
      if (normalized.includes("SUMMARY")) return 9;
      if (normalized.includes("SCOR") || normalized.includes("INTENT"))
        return 8;
      if (normalized.includes("INSIGHT") || normalized.includes("ANALYSIS"))
        return 7;
      if (normalized.includes("NEWS")) return 6;
      if (normalized.includes("CAREER")) return 5;
      if (normalized.includes("SERVICE")) return 4;
      if (normalized.includes("ABOUT")) return 3;
      if (normalized.includes("DECISION") || normalized.includes("CONTACT"))
        return 2;
      if (normalized.includes("ENRICH") || normalized.includes("WEBSITE"))
        return 1;
      return Math.min(
        jobStages.length - 1,
        Math.max(0, Math.floor(((progress ?? 0) / 100) * jobStages.length)),
      );
    };
    const applyPayload = (payload?: ProgressPayload) => {
      const status = (
        payload?.job?.status ??
        payload?.search?.status ??
        "RUNNING"
      ).toUpperCase();
      const currentProgress = payload?.job?.progress ?? 0;
      if (!active) return true;
      setFailure("");
      setServerProgress(currentProgress);
      setRecords(payload?.resultCount ?? 0);
      setActiveStage(stageIndex(payload?.job?.stage, currentProgress));
      if (["COMPLETE", "PARTIAL"].includes(status)) {
        finished = true;
        onComplete();
        return true;
      }
      if (["FAILED", "CANCELLED"].includes(status)) {
        finished = true;
        setFailure(
          "The research job failed. No fixture results were substituted and reserved credits will follow the server refund policy.",
        );
        return true;
      }
      return false;
    };
    const poll = async () => {
      if (polling || finished) return;
      polling = true;
      try {
        const response = await fetch(
          `/api/search/${encodeURIComponent(searchId)}`,
          { headers: { Accept: "application/json" }, cache: "no-store" },
        );
        const json = (await response.json().catch(() => ({}))) as {
          data?: {
            data?: unknown;
            search?: { status?: string };
            job?: { status?: string; stage?: string; progress?: number };
            resultCount?: number;
          };
          error?: { message?: string };
        };
        if (!response.ok)
          throw new Error(
            json.error?.message ??
              `Status check failed with ${response.status}`,
          );
        const payload = (
          json.data && "data" in json.data && json.data.data
            ? json.data.data
            : json.data
        ) as ProgressPayload | undefined;
        if (!applyPayload(payload)) {
          polling = false;
          timer = window.setTimeout(poll, 1800);
        }
      } catch (error) {
        if (!active) return;
        polling = false;
        setFailure(
          error instanceof Error
            ? error.message
            : "The job status could not be checked.",
        );
      }
    };
    try {
      eventSource = new EventSource(
        `/api/search/${encodeURIComponent(searchId)}/events`,
      );
      eventSource.addEventListener("progress", (message) => {
        try {
          applyPayload(
            JSON.parse(
              (message as MessageEvent<string>).data,
            ) as ProgressPayload,
          );
        } catch {
          // A malformed progress frame falls back to the polling path.
        }
      });
      eventSource.addEventListener("failure", () => {
        eventSource?.close();
        polling = false;
        void poll();
      });
      eventSource.onerror = () => {
        eventSource?.close();
        if (!finished) {
          polling = false;
          void poll();
        }
      };
    } catch {
      void poll();
    }
    return () => {
      active = false;
      eventSource?.close();
      if (timer) window.clearTimeout(timer);
    };
  }, [demo, onComplete, pollNonce, searchId]);

  const progress =
    serverProgress ??
    Math.round(((activeStage + 0.35) / jobStages.length) * 100);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <Surface className="overflow-hidden">
        <div className="border-b border-zinc-200 p-5 sm:p-7 dark:border-zinc-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={failure ? "danger" : "warning"}>
                  {failure ? (
                    <XCircle className="size-3" />
                  ) : (
                    <LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" />
                  )}
                  {failure ? "Needs attention" : "Working"}
                </StatusBadge>
                <span className="text-xs text-zinc-500" aria-live="polite">
                  Stage {activeStage + 1} of {jobStages.length}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-zinc-950 dark:text-white">
                {failure ? "Research paused" : "Building your prospect list"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {failure ||
                  "You can leave this page. The job continues in the background and we’ll notify you when the evidence and scores are ready."}
              </p>
              {failure ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-4"
                  onClick={() => {
                    setFailure("");
                    setPollNonce((value) => value + 1);
                  }}
                >
                  <RefreshCw className="size-3.5" />
                  Check status again
                </Button>
              ) : null}
            </div>
            <Link
              href="/companies"
              className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-medium text-zinc-700 outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-100"
            >
              Continue in background
            </Link>
          </div>
          <div
            className="mt-6 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Search progress"
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out motion-reduce:transition-none dark:bg-blue-400"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <ol
          className="divide-y divide-zinc-200 px-5 sm:px-7 dark:divide-zinc-800"
          aria-live="polite"
        >
          {jobStages.map((stage, index) => {
            const complete = index < activeStage;
            const active = index === activeStage;
            return (
              <li
                key={stage.key}
                className={cx(
                  "flex min-h-[4.75rem] items-center gap-4 py-3 transition-opacity duration-200 motion-reduce:transition-none",
                  index > activeStage && "opacity-45",
                )}
              >
                <span
                  className={cx(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border",
                    complete &&
                      "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-400 dark:text-slate-950",
                    active &&
                      "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                    index > activeStage &&
                      "border-zinc-300 text-zinc-400 dark:border-zinc-700",
                  )}
                >
                  {complete ? (
                    <Check className="size-4" />
                  ) : active ? (
                    <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Circle className="size-3" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {stage.label}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">
                    {stage.detail}
                  </span>
                </span>
                <span className="text-[11px] font-medium text-zinc-500">
                  {complete ? "Done" : active ? "In progress" : "Waiting"}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-col gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex gap-5 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="tabular-nums">
              <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                {records}
              </strong>{" "}
              records found
            </span>
            <span className="tabular-nums">
              <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                {elapsed}s
              </strong>{" "}
              elapsed
            </span>
          </div>
          {demo ? (
            <Button variant="secondary" size="sm" onClick={onReveal}>
              Show demo results now
            </Button>
          ) : (
            <span className="text-[11px] text-zinc-500">
              Live status · automatic refresh
            </span>
          )}
        </div>
      </Surface>
      <aside className="space-y-4">
        <Surface className="p-5">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
            Search brief
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {brief ||
              (mode === "b2c"
                ? "Permissioned customers invited to voluntary product research"
                : "SaaS founders in India, 20–200 employees, hiring sales")}
          </p>
          <dl className="mt-5 space-y-3 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Mode</dt>
              <dd className="font-medium">{mode.toUpperCase()}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Qualified lead goal</dt>
              <dd className="font-medium">
                {targetCount ?? "Confirmed by job"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Maximum cost</dt>
              <dd className="font-medium">
                {targetCount !== undefined
                  ? `${targetCount} credits`
                  : "Confirmed by ledger"}
              </dd>
            </div>
            {mode === "b2c" ? (
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Retention</dt>
                <dd className="font-medium">{retentionDays} days</dd>
              </div>
            ) : null}
          </dl>
        </Surface>
        <div className="flex gap-3 px-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <p>
            {mode === "b2c"
              ? "Every record is checked for consent or documented permission, suppression status, source provenance, and purpose-limited retention."
              : "Athreix reviews extra source candidates, then normalizes, deduplicates, qualifies, and stores no more than the requested lead count."}
          </p>
        </div>
      </aside>
    </div>
  );
}

export function CompletedRunSummary({
  mode = "b2b",
  count = 0,
  chargedCredits,
  targetCount,
}: {
  mode?: ResearchMode;
  count?: number;
  chargedCredits?: number;
  targetCount?: number;
}) {
  const countLabel =
    targetCount !== undefined && count < targetCount
      ? `${count} of ${targetCount} qualified leads found`
      : `${count} qualified lead${count === 1 ? "" : "s"} delivered`;
  return (
    <details className="group rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-100">
        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <Check className="size-3.5" />
        </span>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          Research run completed successfully
        </span>
        <span className="ml-auto text-xs text-zinc-500">
          {jobStages.length} stages · {countLabel}
          {chargedCredits !== undefined ? ` · ${chargedCredits} credits` : ""}
          {mode === "b2c" ? " · permission controls applied" : ""}
        </span>
      </summary>
      <div className="grid gap-3 border-t border-zinc-200 px-4 py-4 text-xs sm:grid-cols-3 dark:border-zinc-800">
        {jobStages.map((stage) => (
          <div
            key={stage.key}
            className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400"
          >
            <Check className="size-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>{stage.label}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
