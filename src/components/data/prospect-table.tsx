"use client";

import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowUpRight,
  Building2,
  Mail,
  MapPin,
  MoreHorizontal,
} from "lucide-react";
import type { Prospect, ResearchMode } from "@/lib/demo/types";
import { isMaskedContactValue } from "@/lib/leads/columns";
import { CompleteLeadTable } from "@/components/data/complete-lead-table";
import { IconButton, StatusBadge, cx } from "@/components/product/ui";

const columns =
  "44px minmax(210px,1.35fr) minmax(170px,1fr) minmax(150px,.85fr) minmax(170px,1fr) 82px 96px 44px";

function nullableText(value: string | undefined) {
  if (isMaskedContactValue(value)) return "restricted";
  if (
    !value ||
    [
      "Not available",
      "Company not available",
      "Location not available",
    ].includes(value)
  )
    return "null";
  return value;
}

function isUsableEmail(value: string) {
  return (
    value !== "null" && value.includes("@") && !isMaskedContactValue(value)
  );
}

function NativeCheckbox({
  checked,
  mixed,
  onChange,
  label,
}: {
  checked: boolean;
  mixed?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(mixed);
  }, [mixed]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={label}
      className="size-4 cursor-pointer accent-zinc-950 dark:accent-white"
    />
  );
}

function Score({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-2"
      aria-label={`AI score ${value} out of 100`}
    >
      <span
        className={cx(
          "tabular-nums text-sm font-semibold",
          value >= 80
            ? "text-zinc-950 dark:text-white"
            : "text-zinc-700 dark:text-zinc-300",
        )}
      >
        {value}
      </span>
      <span
        aria-hidden="true"
        className="h-1.5 w-7 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
      >
        <span
          className={cx(
            "block h-full rounded-full",
            value >= 80 ? "bg-blue-600 dark:bg-blue-400" : "bg-slate-500",
          )}
          style={{ width: `${value}%` }}
        />
      </span>
    </span>
  );
}

export function ProspectTable({
  prospects,
  selected,
  onSelectionChange,
  onOpen,
  mode = "b2b",
  contactDetailsStatus = "idle",
}: {
  prospects: Prospect[];
  selected: Set<string>;
  onSelectionChange: (selection: Set<string>) => void;
  onOpen: (prospect: Prospect) => void;
  mode?: ResearchMode;
  contactDetailsStatus?:
    "idle" | "loading" | "revealed" | "restricted" | "not_applicable";
}) {
  const [desktopView, setDesktopView] = useState<"complete" | "summary">(
    "complete",
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: prospects.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 66,
    overscan: 7,
  });
  const allSelected =
    prospects.length > 0 &&
    prospects.every((prospect) => selected.has(prospect.id));
  const someSelected = prospects.some((prospect) => selected.has(prospect.id));
  const toggleAll = (checked: boolean) =>
    onSelectionChange(
      checked ? new Set(prospects.map((item) => item.id)) : new Set(),
    );
  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  };

  return (
    <>
      {mode === "b2b" ? (
        <div className="mb-3 hidden items-center justify-between gap-3 md:flex">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-zinc-500">
              {desktopView === "complete"
                ? "Showing all 36 fields from the live Apify lead record."
                : "Showing the compact qualification view."}
            </p>
            <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-[10px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              missing = null
            </span>
            {contactDetailsStatus === "loading" ? (
              <StatusBadge tone="neutral">Loading full contacts</StatusBadge>
            ) : contactDetailsStatus === "revealed" ? (
              <StatusBadge tone="success">Full contacts loaded</StatusBadge>
            ) : contactDetailsStatus === "restricted" ? (
              <StatusBadge tone="warning">
                Contacts require member access
              </StatusBadge>
            ) : null}
          </div>
          <div
            className="inline-flex rounded-xl border border-zinc-200 bg-white/80 p-1 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950"
            role="group"
            aria-label="Lead table view"
          >
            <button
              type="button"
              onClick={() => setDesktopView("complete")}
              aria-pressed={desktopView === "complete"}
              className={cx(
                "min-h-8 rounded-md px-3 text-xs font-medium",
                desktopView === "complete"
                  ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
              )}
            >
              All 36 columns
            </button>
            <button
              type="button"
              onClick={() => setDesktopView("summary")}
              aria-pressed={desktopView === "summary"}
              className={cx(
                "min-h-8 rounded-md px-3 text-xs font-medium",
                desktopView === "summary"
                  ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
              )}
            >
              Summary
            </button>
          </div>
        </div>
      ) : null}
      {mode === "b2b" && desktopView === "complete" ? (
        <CompleteLeadTable
          prospects={prospects}
          selected={selected}
          onSelectionChange={onSelectionChange}
          onOpen={onOpen}
        />
      ) : (
        <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_20px_65px_oklch(0.17_0.03_272/0.08)] md:block dark:border-zinc-800 dark:bg-zinc-950">
          <div
            role="table"
            aria-label="Prospect results"
            aria-rowcount={prospects.length + 1}
            className="min-w-[1120px]"
          >
            <div
              role="rowgroup"
              className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div
                role="row"
                className="grid min-h-11 items-center text-[11px] font-medium text-zinc-600 dark:text-zinc-400"
                style={{ gridTemplateColumns: columns }}
              >
                <div role="columnheader" className="px-3">
                  <NativeCheckbox
                    checked={allSelected}
                    mixed={someSelected && !allSelected}
                    onChange={toggleAll}
                    label={
                      allSelected
                        ? "Clear all prospect selections"
                        : "Select all visible prospects"
                    }
                  />
                </div>
                <div role="columnheader" className="px-3">
                  {mode === "b2c" ? "Person" : "Prospect"}
                </div>
                <div role="columnheader" className="px-3">
                  {mode === "b2c" ? "Audience source" : "Company"}
                </div>
                <div role="columnheader" className="px-3">
                  Location
                </div>
                <div role="columnheader" className="px-3">
                  Contact
                </div>
                <div role="columnheader" className="px-3">
                  {mode === "b2c" ? "Relevance" : "AI score"}
                </div>
                <div role="columnheader" className="px-3">
                  {mode === "b2c" ? "Permission" : "Verification"}
                </div>
                <div role="columnheader">
                  <span className="sr-only">Actions</span>
                </div>
              </div>
            </div>
            <div
              ref={scrollRef}
              role="rowgroup"
              className="relative h-[560px] overflow-auto"
              tabIndex={0}
              aria-label="Scrollable prospect rows"
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const prospect = prospects[virtualRow.index];
                  if (!prospect) return null;
                  const email = nullableText(
                    prospect.leadFields?.email?.toString() ?? prospect.email,
                  );
                  return (
                    <div
                      key={prospect.id}
                      role="row"
                      aria-rowindex={virtualRow.index + 2}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className={cx(
                        "absolute left-0 top-0 grid w-full min-h-[66px] items-center border-b border-zinc-100 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/70",
                        selected.has(prospect.id) &&
                          "bg-blue-50/70 dark:bg-blue-950/20",
                      )}
                      style={{
                        gridTemplateColumns: columns,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div role="cell" className="px-3">
                        <NativeCheckbox
                          checked={selected.has(prospect.id)}
                          onChange={(checked) => toggle(prospect.id, checked)}
                          label={`Select ${prospect.name}`}
                        />
                      </div>
                      <div role="cell" className="min-w-0 px-3">
                        <button
                          onClick={() => onOpen(prospect)}
                          className="block max-w-full rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-100"
                        >
                          <span className="block truncate font-medium text-zinc-950 dark:text-white">
                            {prospect.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {prospect.title}
                          </span>
                        </button>
                      </div>
                      <div role="cell" className="min-w-0 px-3">
                        <span className="block truncate font-medium text-zinc-800 dark:text-zinc-200">
                          {mode === "b2c"
                            ? prospect.consumer?.source
                            : prospect.company}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">
                          {mode === "b2c"
                            ? "Recorded permission · current check pending"
                            : `${prospect.industry} · ${prospect.companySize}`}
                        </span>
                      </div>
                      <div
                        role="cell"
                        className="min-w-0 px-3 text-xs text-zinc-600 dark:text-zinc-400"
                      >
                        <span className="block truncate">
                          {prospect.location}
                        </span>
                      </div>
                      <div role="cell" className="min-w-0 px-3">
                        {mode === "b2b" && isUsableEmail(email) ? (
                          <a
                            href={`mailto:${email}`}
                            className="block break-all text-xs text-blue-700 hover:underline dark:text-blue-400"
                          >
                            {email}
                          </a>
                        ) : (
                          <span
                            className={`block break-all text-xs ${
                              email === "null"
                                ? "font-mono text-zinc-400"
                                : "text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            {mode === "b2c"
                              ? "Masked until current check"
                              : email}
                          </span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-zinc-500">
                          {mode === "b2c"
                            ? "Open record to review"
                            : `${prospect.channel} recommended`}
                        </span>
                      </div>
                      <div role="cell" className="px-3">
                        <Score value={prospect.score} />
                      </div>
                      <div role="cell" className="px-3">
                        <StatusBadge
                          tone={
                            mode === "b2c"
                              ? "warning"
                              : prospect.status === "Verified"
                                ? "success"
                                : prospect.status === "Limited"
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {mode === "b2c" ? "Review" : prospect.status}
                        </StatusBadge>
                      </div>
                      <div role="cell">
                        <IconButton
                          aria-label={`Open details for ${prospect.name}`}
                          onClick={() => onOpen(prospect)}
                        >
                          <MoreHorizontal className="size-4" />
                        </IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="space-y-3 md:hidden"
        aria-label="Prospect results, compact view"
      >
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm dark:border-zinc-800">
          <NativeCheckbox
            checked={allSelected}
            mixed={someSelected && !allSelected}
            onChange={toggleAll}
            label={
              allSelected
                ? "Clear all prospect selections"
                : "Select all visible prospects"
            }
          />
          <span>Select all {prospects.length} visible prospects</span>
        </label>
        {prospects.map((prospect) => (
          <article
            key={prospect.id}
            className={cx(
              "rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_14px_40px_oklch(0.17_0.03_272/0.07)] dark:border-zinc-800 dark:bg-zinc-950",
              selected.has(prospect.id) &&
                "border-blue-400 dark:border-blue-700",
            )}
          >
            <div className="flex items-start gap-3">
              <NativeCheckbox
                checked={selected.has(prospect.id)}
                onChange={(checked) => toggle(prospect.id, checked)}
                label={`Select ${prospect.name}`}
              />
              <button
                onClick={() => onOpen(prospect)}
                className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-100"
              >
                <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-white">
                  {prospect.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-zinc-600 dark:text-zinc-400">
                  {prospect.title}
                </span>
              </button>
              <Score value={prospect.score} />
            </div>
            <dl className="mt-4 grid grid-cols-[1.1rem_1fr] gap-x-2 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              <Building2 className="size-3.5" />
              <div>
                <dt className="sr-only">
                  {mode === "b2c" ? "Audience source" : "Company"}
                </dt>
                <dd>
                  {mode === "b2c"
                    ? `${prospect.consumer?.source} · ${prospect.consumer?.relationship}`
                    : `${prospect.company} · ${prospect.industry}`}
                </dd>
              </div>
              <MapPin className="size-3.5" />
              <div>
                <dt className="sr-only">Location</dt>
                <dd>{prospect.location}</dd>
              </div>
              <Mail className="size-3.5" />
              <div className="min-w-0">
                <dt className="sr-only">Email</dt>
                {mode === "b2b" &&
                isUsableEmail(
                  nullableText(
                    prospect.leadFields?.email?.toString() ?? prospect.email,
                  ),
                ) ? (
                  <dd className="break-all">
                    <a
                      href={`mailto:${nullableText(
                        prospect.leadFields?.email?.toString() ??
                          prospect.email,
                      )}`}
                      className="text-blue-700 hover:underline dark:text-blue-400"
                    >
                      {nullableText(
                        prospect.leadFields?.email?.toString() ??
                          prospect.email,
                      )}
                    </a>
                  </dd>
                ) : (
                  <dd
                    className={
                      mode === "b2b" &&
                      nullableText(
                        prospect.leadFields?.email?.toString() ??
                          prospect.email,
                      ) === "null"
                        ? "font-mono text-zinc-400"
                        : "break-all"
                    }
                  >
                    {mode === "b2c"
                      ? "Masked until current check"
                      : nullableText(
                          prospect.leadFields?.email?.toString() ??
                            prospect.email,
                        )}
                  </dd>
                )}
              </div>
            </dl>
            <div className="mt-4 flex items-center justify-between gap-3">
              <StatusBadge
                tone={
                  mode === "b2c"
                    ? "warning"
                    : prospect.status === "Verified"
                      ? "success"
                      : prospect.status === "Limited"
                        ? "warning"
                        : "neutral"
                }
              >
                {mode === "b2c" ? "Review" : prospect.status}
              </StatusBadge>
              <button
                onClick={() => onOpen(prospect)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-zinc-700 outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-100"
              >
                Full record
                <ArrowUpRight className="size-3.5" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
