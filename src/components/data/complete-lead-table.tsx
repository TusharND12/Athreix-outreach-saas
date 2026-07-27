"use client";

import { useEffect, useMemo, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Prospect } from "@/lib/demo/types";
import {
  compactLeadRecord,
  displayLeadValue,
  isMaskedContactValue,
  LEAD_COLUMN_DEFINITIONS,
  type LeadColumnKey,
} from "@/lib/leads/columns";

const linkColumns = new Set<LeadColumnKey>([
  "linkedin",
  "company_website",
  "company_linkedin",
]);
const emailColumns = new Set<LeadColumnKey>(["email", "personal_email"]);
const phoneColumns = new Set<LeadColumnKey>(["mobile_number", "company_phone"]);

function SelectionCheckbox({
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

function fieldsForProspect(prospect: Prospect) {
  if (prospect.leadFields) return compactLeadRecord(prospect.leadFields);
  const nameParts = prospect.name.trim().split(/\s+/);
  return compactLeadRecord({
    first_name: nameParts[0],
    last_name: nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined,
    full_name: prospect.name,
    job_title: prospect.title,
    email: prospect.email,
    mobile_number: prospect.phone,
    linkedin: prospect.linkedin,
    company_name: prospect.company,
    company_website: prospect.website,
    industry: prospect.industry,
    company_size: prospect.companySize,
  });
}

export function CompleteLeadTable({
  prospects,
  selected,
  onSelectionChange,
  onOpen,
}: {
  prospects: Prospect[];
  selected: Set<string>;
  onSelectionChange: (selection: Set<string>) => void;
  onOpen: (prospect: Prospect) => void;
}) {
  const rows = useMemo(
    () =>
      prospects.map((prospect) => ({
        prospect,
        fields: fieldsForProspect(prospect),
      })),
    [prospects],
  );
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
    <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_20px_65px_oklch(0.17_0.03_272/0.08)] md:block dark:border-zinc-800 dark:bg-zinc-950">
      <div className="max-h-[560px] overflow-auto">
        <table
          className="w-max border-separate border-spacing-0 text-left text-xs"
          aria-label="Complete lead results with all 36 Apify columns"
        >
          <thead className="sticky top-0 z-20 bg-[oklch(0.945_0.014_88/0.96)] backdrop-blur-xl dark:bg-zinc-900/95">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-30 w-11 min-w-11 border-b border-r border-zinc-200 bg-[oklch(0.945_0.014_88)] px-3 py-3.5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <SelectionCheckbox
                  checked={allSelected}
                  mixed={someSelected && !allSelected}
                  onChange={toggleAll}
                  label={
                    allSelected
                      ? "Clear all prospect selections"
                      : "Select all visible prospects"
                  }
                />
              </th>
              {LEAD_COLUMN_DEFINITIONS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  title={column.label}
                  className="border-b border-r border-zinc-200 px-3 py-3.5 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
                  style={{ minWidth: column.width, width: column.width }}
                >
                  <span className="block whitespace-nowrap font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-700 dark:text-zinc-300">
                    {column.key}
                  </span>
                  <span className="mt-1 block whitespace-nowrap text-[10px] font-normal text-zinc-500">
                    {column.label}
                  </span>
                </th>
              ))}
              <th
                scope="col"
                className="sticky right-0 z-30 min-w-24 border-b border-l border-zinc-200 bg-[oklch(0.945_0.014_88)] px-3 py-3.5 text-right font-bold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
              >
                Record
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ prospect, fields }) => (
              <tr
                key={prospect.id}
                className="group even:bg-zinc-50/45 hover:bg-blue-50/55 dark:even:bg-zinc-900/30 dark:hover:bg-blue-950/20"
              >
                <td className="sticky left-0 z-10 border-b border-r border-zinc-100 bg-white px-3 py-3 group-even:bg-zinc-50 group-hover:bg-blue-50 dark:border-zinc-900 dark:bg-zinc-950 dark:group-even:bg-zinc-900 dark:group-hover:bg-blue-950">
                  <SelectionCheckbox
                    checked={selected.has(prospect.id)}
                    onChange={(checked) => toggle(prospect.id, checked)}
                    label={`Select ${prospect.name}`}
                  />
                </td>
                {LEAD_COLUMN_DEFINITIONS.map((column) => {
                  const value = fields[column.key];
                  const isMasked = isMaskedContactValue(value);
                  const display = isMasked
                    ? "restricted"
                    : displayLeadValue(value);
                  const isNull = display === "null";
                  const isLink =
                    linkColumns.has(column.key) &&
                    typeof value === "string" &&
                    /^https?:\/\//i.test(value);
                  const isEmail =
                    emailColumns.has(column.key) &&
                    typeof value === "string" &&
                    value.includes("@") &&
                    !isMasked;
                  const isPhone =
                    phoneColumns.has(column.key) &&
                    typeof value === "string" &&
                    !isMasked;
                  return (
                    <td
                      key={column.key}
                      className="border-b border-r border-zinc-100 px-3 py-3 align-top text-zinc-700 dark:border-zinc-900 dark:text-zinc-300"
                      style={{ minWidth: column.width, width: column.width }}
                      title={display}
                    >
                      {isLink ? (
                        <a
                          href={value}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-start gap-1 break-all text-blue-700 hover:underline dark:text-blue-400"
                        >
                          <span>{display}</span>
                          <ArrowUpRight className="mt-0.5 size-3 shrink-0" />
                        </a>
                      ) : isEmail ? (
                        <a
                          href={`mailto:${value}`}
                          className="block break-all font-medium text-blue-700 hover:underline dark:text-blue-400"
                        >
                          {display}
                        </a>
                      ) : isPhone ? (
                        <a
                          href={`tel:${value}`}
                          className="block break-all text-blue-700 hover:underline dark:text-blue-400"
                        >
                          {display}
                        </a>
                      ) : isNull ? (
                        <span className="block font-mono text-[11px] text-zinc-400 dark:text-zinc-600">
                          null
                        </span>
                      ) : isMasked ? (
                        <span className="block text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          restricted
                        </span>
                      ) : emailColumns.has(column.key) ? (
                        <span className="block break-all">{display}</span>
                      ) : (
                        <span className="line-clamp-3 break-words leading-5">
                          {display}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="sticky right-0 z-10 border-b border-l border-zinc-100 bg-white px-3 py-2 text-right group-even:bg-zinc-50 group-hover:bg-blue-50 dark:border-zinc-900 dark:bg-zinc-950 dark:group-even:bg-zinc-900 dark:group-hover:bg-blue-950">
                  <button
                    type="button"
                    aria-label={`Open details for ${prospect.name}`}
                    onClick={() => onOpen(prospect)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-transparent px-2.5 font-semibold text-zinc-700 outline-none hover:border-primary/15 hover:bg-primary/[0.055] hover:text-primary focus-visible:ring-2 focus-visible:ring-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-100"
                  >
                    Open
                    <ArrowUpRight className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
