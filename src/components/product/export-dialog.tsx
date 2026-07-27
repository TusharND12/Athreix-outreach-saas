"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Check,
  Download,
  Database,
  FileJson2,
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  downloadDemoFile,
  isLocalDemoFallbackAllowed,
} from "@/lib/demo/client";
import { Button, IconButton, InlineNotice, SelectField, cx } from "./ui";

type ExportFormat = "CSV" | "XLSX" | "JSON" | "PDF" | "CRM" | "AI_REPORT";
type ExportField =
  | "PROFILE"
  | "COMPANY_OR_AUDIENCE"
  | "CONTACT"
  | "LEAD_DATA"
  | "AI_ANALYSIS"
  | "PROVENANCE";

const exportFields: Array<{
  value: ExportField;
  label: string;
  description: string;
}> = [
  {
    value: "PROFILE",
    label: "Profile",
    description: "Name, subject type, title, and location",
  },
  {
    value: "COMPANY_OR_AUDIENCE",
    label: "Company or audience",
    description: "Company, industry, and website context",
  },
  {
    value: "CONTACT",
    label: "Contact",
    description: "Permitted email, phone, and professional profile fields",
  },
  {
    value: "LEAD_DATA",
    label: "Complete lead data",
    description:
      "All 36 Leads Finder columns, preserving the Apify field names",
  },
  {
    value: "AI_ANALYSIS",
    label: "AI analysis",
    description: "Score, intent, and reviewed summary",
  },
  {
    value: "PROVENANCE",
    label: "Provenance",
    description: "Consent status, source provider, and source URL",
  },
];

const exportFormats: Array<{
  value: ExportFormat;
  label: string;
  detail: string;
}> = [
  { value: "CSV", label: "CSV", detail: "Universal table" },
  { value: "XLSX", label: "Excel", detail: "Formatted workbook" },
  { value: "JSON", label: "JSON", detail: "Structured data" },
  { value: "PDF", label: "PDF", detail: "Shareable document" },
  { value: "CRM", label: "CRM", detail: "Import-ready CSV" },
  { value: "AI_REPORT", label: "AI report", detail: "Executive PDF" },
];

function exportExtension(format: ExportFormat) {
  if (format === "PDF" || format === "AI_REPORT") return "pdf";
  if (format === "CRM") return "csv";
  return format.toLowerCase();
}

export function ExportDialog({
  open,
  onOpenChange,
  selectedCount = 0,
  selectedIds = [],
  consumerData = false,
  searchId,
  listId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount?: number;
  selectedIds?: string[];
  consumerData?: boolean;
  searchId?: string;
  listId?: string;
}) {
  const [format, setFormat] = useState<ExportFormat>("CSV");
  const [scope, setScope] = useState(selectedCount ? "selected" : "score");
  const [threshold, setThreshold] = useState("80");
  const [verified, setVerified] = useState(false);
  const [fields, setFields] = useState<ExportField[]>(
    exportFields.map((field) => field.value),
  );
  const [lawfulAccepted, setLawfulAccepted] = useState(false);
  const [auditAccepted, setAuditAccepted] = useState(false);
  const [state, setState] = useState<"configure" | "preparing" | "ready">(
    "configure",
  );
  const [preparedFile, setPreparedFile] = useState<Blob | null>(null);
  const [demoPrepared, setDemoPrepared] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);
  const selectedIdsKey = selectedIds.join("\u001f");

  useEffect(() => {
    if (!open) return;
    setScope(selectedCount ? "selected" : "score");
  }, [open, selectedCount]);

  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [
    auditAccepted,
    consumerData,
    fields,
    format,
    lawfulAccepted,
    listId,
    scope,
    searchId,
    selectedIdsKey,
    threshold,
    verified,
  ]);

  const create = async () => {
    if (!searchId && !listId) {
      setError(
        "Open a search or saved list first so Athreix can determine the authorized record scope.",
      );
      return;
    }
    setState("preparing");
    setError("");
    const payload = {
      searchId,
      listId,
      format,
      selectedIds:
        scope === "selected" && selectedIds.length ? selectedIds : undefined,
      minScore: scope === "score" ? Number(threshold) : undefined,
      onlyVerified: consumerData ? verified : false,
      fields,
      acknowledgeLawfulUse: true,
    };
    const idempotencyKey =
      idempotencyKeyRef.current ?? `export-${crypto.randomUUID()}`;
    idempotencyKeyRef.current = idempotencyKey;
    let response: Response;
    try {
      response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      if (isLocalDemoFallbackAllowed()) {
        idempotencyKeyRef.current = null;
        setPreparedFile(null);
        setDemoPrepared(true);
        setState("ready");
        return;
      }
      setError("The export service is unreachable. No file was created.");
      setState("configure");
      return;
    }
    if (!response.ok) {
      idempotencyKeyRef.current = null;
      const responseBody = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        message?: string;
      };
      setError(
        responseBody.error?.message ??
          responseBody.message ??
          `Export blocked with status ${response.status}.`,
      );
      setState("configure");
      return;
    }
    idempotencyKeyRef.current = null;
    setPreparedFile(await response.blob());
    setDemoPrepared(false);
    setState("ready");
  };
  const download = () => {
    if (preparedFile) {
      const url = URL.createObjectURL(preparedFile);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `athreix-prospects.${exportExtension(format)}`;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (!demoPrepared) return;
    const delimiter = format === "CSV" || format === "CRM" ? "," : "\t";
    downloadDemoFile(
      `athreix-prospects.${exportExtension(format)}`,
      format === "JSON"
        ? JSON.stringify(
            [{ name: "Ananya Rao", company: "SignalNest", score: 96 }],
            null,
            2,
          )
        : format === "PDF" || format === "AI_REPORT"
          ? "Athreix AI Lead Intelligence Report\n\nSignalNest\nLead score: 96\nReview retained evidence before outreach."
          : `Name${delimiter}Company${delimiter}Score\nAnanya Rao${delimiter}SignalNest${delimiter}96`,
      format === "JSON"
        ? "application/json"
        : format === "PDF" || format === "AI_REPORT"
          ? "text/plain"
          : "text/csv",
    );
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) {
          idempotencyKeyRef.current = null;
          window.setTimeout(() => {
            setState("configure");
            setError("");
            setPreparedFile(null);
            setDemoPrepared(false);
            setVerified(false);
            setLawfulAccepted(false);
            setAuditAccepted(false);
          }, 200);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white shadow-[0_8px_24px_rgba(0,0,0,0.22)] outline-none dark:bg-zinc-950">
          <div className="flex min-h-16 items-center gap-3 border-b border-zinc-200 px-5 dark:border-zinc-800">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-sm font-semibold text-zinc-950 dark:text-white">
                Prepare export
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-zinc-500">
                Choose authorized records and fields
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton aria-label="Close export">
                <X className="size-4" />
              </IconButton>
            </Dialog.Close>
          </div>
          {state === "ready" ? (
            <div className="flex min-h-[24rem] flex-col items-center justify-center p-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                <Check className="size-6" />
              </span>
              <h2 className="mt-5 text-lg font-semibold text-zinc-950 dark:text-white">
                Your export is ready
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {demoPrepared
                  ? "This local demo file was prepared in your browser and was not written to export history."
                  : "The server prepared the authorized fields and recorded the action in export history."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button onClick={download}>
                  <Download className="size-4" />
                  Download {format}
                </Button>
                <Dialog.Close asChild>
                  <Button variant="secondary">Done</Button>
                </Dialog.Close>
              </div>
            </div>
          ) : (
            <div className="space-y-6 p-5">
              <fieldset>
                <legend className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  File format
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {exportFormats.map((option) => (
                    <label
                      key={option.value}
                      className={cx(
                        "flex min-h-16 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                        format === option.value
                          ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                          : "border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300",
                      )}
                    >
                      <input
                        type="radio"
                        name="format"
                        value={option.value}
                        checked={format === option.value}
                        onChange={() => setFormat(option.value)}
                        className="sr-only"
                      />
                      {option.value === "JSON" ? (
                        <FileJson2 className="size-4" />
                      ) : option.value === "PDF" ||
                        option.value === "AI_REPORT" ? (
                        <FileText className="size-4" />
                      ) : option.value === "CRM" ? (
                        <Database className="size-4" />
                      ) : (
                        <FileSpreadsheet className="size-4" />
                      )}
                      <span>
                        <span className="block">{option.label}</span>
                        <span
                          className={cx(
                            "mt-0.5 block text-[10px] font-normal",
                            format === option.value
                              ? "text-current opacity-70"
                              : "text-zinc-500",
                          )}
                        >
                          {option.detail}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Records"
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                >
                  {selectedCount ? (
                    <option value="selected">Selected ({selectedCount})</option>
                  ) : null}
                  <option value="score">Above score threshold</option>
                  <option value="all">All visible</option>
                </SelectField>
                <SelectField
                  label="Minimum score"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                  disabled={scope !== "score"}
                >
                  <option value="65">65+</option>
                  <option value="75">75+</option>
                  <option value="80">80+</option>
                  <option value="90">90+</option>
                </SelectField>
              </div>
              {consumerData ? (
                <label className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={verified}
                    onChange={(event) => setVerified(event.target.checked)}
                    className="size-4 accent-zinc-950 dark:accent-white"
                  />
                  Only include records with current permission evidence
                </label>
              ) : (
                <div
                  role="note"
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                >
                  VERIFIED-only contact filtering is unavailable until a
                  contact-verification provider is configured. Current
                  source-supported records remain eligible for review and
                  export.
                </div>
              )}
              <fieldset>
                <legend className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Included fields
                </legend>
                <div className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {exportFields.map((field) => (
                    <label
                      key={field.value}
                      className="flex min-h-14 cursor-pointer items-start gap-3 px-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={fields.includes(field.value)}
                        onChange={(event) =>
                          setFields((current) =>
                            event.target.checked
                              ? [...current, field.value]
                              : current.filter(
                                  (value) => value !== field.value,
                                ),
                          )
                        }
                        className="mt-0.5 size-4 shrink-0 accent-zinc-950 dark:accent-white"
                      />
                      <span>
                        <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {field.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-zinc-500">
                          {field.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  Masked, suppressed, or unauthorized values remain omitted
                  regardless of field selection.
                </p>
              </fieldset>
              <InlineNotice
                title="Export is auditable"
                tone={consumerData ? "warning" : "neutral"}
                icon={<ShieldCheck className="size-4" />}
              >
                <p>
                  {consumerData
                    ? "Consumer exports apply the workspace suppression list and retain purpose, lawful basis, source, consent status, and deletion date. Every export is logged for review."
                    : "This action is written to your audit log. Use personal data only for an authorized purpose, keep suppression lists current, and delete files when they are no longer needed."}
                </p>
              </InlineNotice>
              <label className="flex items-start gap-3 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={lawfulAccepted}
                  onChange={(event) => setLawfulAccepted(event.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-zinc-950 dark:accent-white"
                />
                I confirm I am authorized to export these records for the
                documented purpose and will protect them after download.
              </label>
              {consumerData ? (
                <label className="flex items-start gap-3 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={auditAccepted}
                    onChange={(event) => setAuditAccepted(event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-zinc-950 dark:accent-white"
                  />
                  I confirm the exported records remain necessary for the
                  documented purpose and that downstream users will honor
                  consent, deletion, and suppression restrictions.
                </label>
              ) : null}
              {error ? (
                <InlineNotice title="Export not created" tone="danger">
                  <p>
                    {error} Review the record permissions or try again when the
                    service is available.
                  </p>
                </InlineNotice>
              ) : null}
            </div>
          )}
          {state !== "ready" ? (
            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[11px] text-zinc-500">
                Server confirms the final eligible record count
              </p>
              <Button
                loading={state === "preparing"}
                disabled={
                  (!searchId && !listId) ||
                  !fields.length ||
                  !lawfulAccepted ||
                  (consumerData && !auditAccepted)
                }
                onClick={create}
              >
                {state === "preparing" ? "Preparing…" : "Create export"}
                <Download className="size-4" />
              </Button>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
