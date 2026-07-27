"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDot,
  Database,
  Eye,
  Globe2,
  Linkedin,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import type { Prospect } from "@/lib/demo/types";
import {
  displayLeadValue,
  isMaskedContactValue,
  LEAD_COLUMN_DEFINITIONS,
  LEAD_COLUMN_GROUPS,
  type LeadColumnKey,
  type LeadRecord,
  type LeadRecordValue,
} from "@/lib/leads/columns";
import { OutreachGenerator } from "@/components/product/outreach-generator";
import {
  Button,
  Divider,
  IconButton,
  InlineNotice,
  StatusBadge,
  cx,
} from "@/components/product/ui";

function Definition({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {children}
      </dd>
    </div>
  );
}

const leadColumnByKey = new Map(
  LEAD_COLUMN_DEFINITIONS.map((column) => [column.key, column]),
);

function LeadFieldDefinition({
  columnKey,
  value,
}: {
  columnKey: LeadColumnKey;
  value: LeadRecordValue | undefined;
}) {
  const column = leadColumnByKey.get(columnKey);
  const isMasked = isMaskedContactValue(value);
  const display = isMasked ? "restricted" : displayLeadValue(value);
  const isNull = display === "null";
  const isEmail =
    ["email", "personal_email"].includes(columnKey) &&
    typeof value === "string" &&
    value.includes("@") &&
    !isMasked;
  const isPhone =
    ["mobile_number", "company_phone"].includes(columnKey) &&
    typeof value === "string" &&
    !isMasked;
  const isLink =
    ["linkedin", "company_website", "company_linkedin"].includes(columnKey) &&
    typeof value === "string" &&
    /^https?:\/\//i.test(value);
  const body = isNull ? (
    <span className="font-mono text-xs font-normal text-zinc-400 dark:text-zinc-600">
      null
    </span>
  ) : isMasked ? (
    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
      restricted
    </span>
  ) : isEmail ? (
    <a
      href={`mailto:${value}`}
      className="break-all text-blue-700 hover:underline dark:text-blue-400"
    >
      {display}
    </a>
  ) : isPhone ? (
    <a
      href={`tel:${value}`}
      className="break-all text-blue-700 hover:underline dark:text-blue-400"
    >
      {display}
    </a>
  ) : isLink ? (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="break-all text-blue-700 hover:underline dark:text-blue-400"
    >
      {display}
    </a>
  ) : (
    <span className="break-words">{display}</span>
  );
  return (
    <div className="min-w-0 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/70">
      <dt>
        <span className="block font-mono text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
          {columnKey}
        </span>
        <span className="mt-0.5 block text-[10px] text-zinc-500">
          {column?.label}
        </span>
      </dt>
      <dd className="mt-2 text-sm font-medium leading-5 text-zinc-800 dark:text-zinc-200">
        {body}
      </dd>
    </div>
  );
}

export function LeadDrawer({
  prospect,
  open,
  contactDetailsRevealed = false,
  onOpenChange,
}: {
  prospect: Prospect | null;
  open: boolean;
  contactDetailsRevealed?: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [section, setSection] = useState<"insight" | "outreach">("insight");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [liveConsent, setLiveConsent] = useState<
    Prospect["consumer"] | undefined
  >();
  const [consentCheck, setConsentCheck] = useState<
    "pending" | "confirmed" | "review"
  >("review");
  const [revealedContact, setRevealedContact] = useState<{
    email?: string;
    phone?: string;
    linkedin?: string;
    leadFields?: LeadRecord;
  } | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState("");

  useEffect(() => {
    if (!prospect) return;
    let active = true;
    const controller = new AbortController();
    setNotes(window.localStorage.getItem(`athreix-note-${prospect.id}`) ?? "");
    setSaved(false);
    setSection("insight");
    setLiveConsent(undefined);
    setConsentCheck(prospect.mode === "b2c" ? "pending" : "review");
    setRevealedContact(
      contactDetailsRevealed
        ? {
            email:
              prospect.leadFields?.email?.toString() ??
              (prospect.email === "Not available" ? undefined : prospect.email),
            phone:
              prospect.leadFields?.mobile_number?.toString() ?? prospect.phone,
            linkedin:
              prospect.leadFields?.linkedin?.toString() ?? prospect.linkedin,
            leadFields: prospect.leadFields,
          }
        : null,
    );
    setRevealError("");
    if (prospect.mode === "b2c") {
      type ConsentRecord = {
        status?: string;
        channel?: string;
        purpose?: string;
        capturedAt?: string;
        expiresAt?: string;
        withdrawnAt?: string | null;
        source?: string;
      };
      fetch(`/api/results/${encodeURIComponent(prospect.id)}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) return undefined;
          const body = (await response.json()) as {
            data?: {
              data?: unknown;
              consent?: ConsentRecord[];
              searchPurpose?: string;
              retentionUntil?: string;
              isSuppressed?: boolean;
            };
          };
          return (body.data?.data ?? body.data) as
            | {
                consent?: ConsentRecord[];
                searchPurpose?: string;
                retentionUntil?: string;
                isSuppressed?: boolean;
              }
            | undefined;
        })
        .then((detail) => {
          if (!active) return;
          if (!detail || detail.isSuppressed || !detail.searchPurpose) {
            setConsentCheck("review");
            return;
          }
          const now = Date.now();
          const current = (detail.consent ?? []).filter(
            (record) =>
              record.status === "GRANTED" &&
              !record.withdrawnAt &&
              record.purpose === detail.searchPurpose &&
              (!record.capturedAt ||
                new Date(record.capturedAt).getTime() <= now) &&
              (!record.expiresAt || new Date(record.expiresAt).getTime() > now),
          );
          const channels = [
            ...new Set(
              current
                .map((record) => record.channel)
                .filter((value): value is string => Boolean(value))
                .map((value) =>
                  value === "EMAIL"
                    ? "Email"
                    : value === "LINKEDIN"
                      ? "LinkedIn"
                      : value === "PHONE"
                        ? "Phone"
                        : value === "WHATSAPP"
                          ? "WhatsApp"
                          : undefined,
                )
                .filter(
                  (
                    value,
                  ): value is "Email" | "LinkedIn" | "Phone" | "WhatsApp" =>
                    Boolean(value),
                ),
            ),
          ];
          const first = current[0];
          if (!first || !channels.length) {
            setConsentCheck("review");
            return;
          }
          setLiveConsent({
            relationship:
              prospect.consumer?.relationship ?? "Permissioned audience member",
            consentStatus: "Confirmed",
            source:
              first.source ?? prospect.consumer?.source ?? "Consent record",
            collectedAt: first.capturedAt
              ? new Date(first.capturedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : (prospect.consumer?.collectedAt ?? "See consent record"),
            retentionUntil: detail.retentionUntil
              ? new Date(detail.retentionUntil).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : (prospect.consumer?.retentionUntil ?? "See search policy"),
            purpose: detail.searchPurpose,
            suppressionChecked:
              prospect.consumer?.suppressionChecked ??
              "Checked during this search",
            allowedChannels: channels,
            permissionExpires:
              first.expiresAt ?? detail.retentionUntil ?? "See consent record",
          });
          setConsentCheck("confirmed");
        })
        .catch(() => {
          if (active) setConsentCheck("review");
        });
    }
    return () => {
      active = false;
      controller.abort();
    };
  }, [contactDetailsRevealed, prospect]);

  if (!prospect) return null;
  const visibleConsent = liveConsent;
  const permissionLabel = visibleConsent
    ? "Confirmed"
    : consentCheck === "pending"
      ? "Check pending"
      : "Review";
  const safeOutreachProspect =
    prospect.mode === "b2c" && !visibleConsent
      ? {
          ...prospect,
          consumer: prospect.consumer
            ? {
                ...prospect.consumer,
                consentStatus: "Review" as const,
                retentionUntil: "Current check pending",
                allowedChannels: [],
              }
            : undefined,
        }
      : visibleConsent
        ? { ...prospect, consumer: visibleConsent }
        : prospect;
  const visibleContact =
    revealedContact ??
    (contactDetailsRevealed
      ? {
          email:
            prospect.leadFields?.email?.toString() ??
            (prospect.email === "Not available" ? undefined : prospect.email),
          phone:
            prospect.leadFields?.mobile_number?.toString() ?? prospect.phone,
          linkedin:
            prospect.leadFields?.linkedin?.toString() ?? prospect.linkedin,
          leadFields: prospect.leadFields,
        }
      : null);
  const visibleEmail = displayLeadValue(
    visibleContact?.leadFields?.email ?? visibleContact?.email,
  );
  const visiblePhone = displayLeadValue(
    visibleContact?.leadFields?.mobile_number ?? visibleContact?.phone,
  );
  const visibleLinkedin = displayLeadValue(
    (prospect.leadFields?.linkedin ?? prospect.linkedin) || undefined,
  );
  const completeLeadValue = (columnKey: LeadColumnKey) => {
    if (!visibleContact) return prospect.leadFields?.[columnKey];
    if (columnKey === "email")
      return visibleContact.leadFields?.email ?? visibleContact.email;
    if (columnKey === "personal_email")
      return visibleContact.leadFields?.personal_email;
    if (columnKey === "mobile_number")
      return visibleContact.leadFields?.mobile_number ?? visibleContact.phone;
    return prospect.leadFields?.[columnKey];
  };
  const saveNote = () => {
    window.localStorage.setItem(`athreix-note-${prospect.id}`, notes);
    setSaved(true);
  };
  const revealContact = async () => {
    setRevealing(true);
    setRevealError("");
    try {
      const response = await fetch(
        `/api/results/${encodeURIComponent(prospect.id)}?reveal=true`,
        { headers: { Accept: "application/json" }, cache: "no-store" },
      );
      const body = (await response.json().catch(() => ({}))) as {
        data?: {
          email?: string;
          phone?: string;
          linkedin?: string;
          leadFields?: LeadRecord;
        };
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(
          body.error?.message ??
            `Contact reveal blocked with status ${response.status}.`,
        );
      const values = body.data;
      if (
        !values ||
        (!values.email &&
          !values.phone &&
          !values.linkedin &&
          !values.leadFields?.email &&
          !values.leadFields?.personal_email &&
          !values.leadFields?.mobile_number)
      )
        throw new Error(
          "No contact channel was eligible for reveal under the current role, retention, suppression, and permission rules.",
        );
      setRevealedContact({
        email: values.email,
        phone: values.phone,
        linkedin: values.linkedin,
        leadFields: values.leadFields,
      });
    } catch (error) {
      setRevealedContact(null);
      setRevealError(
        error instanceof Error
          ? error.message
          : "Contact details could not be revealed.",
      );
    } finally {
      setRevealing(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[oklch(0.08_0.03_272/0.62)] backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-2 right-2 z-50 flex w-[calc(100%_-_1rem)] max-w-2xl flex-col overflow-hidden rounded-[1.5rem] border border-white/20 bg-white/96 shadow-[-24px_0_80px_oklch(0.08_0.03_272/0.3)] outline-none backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/96">
          <div className="flex min-h-16 items-center gap-3 border-b border-zinc-200 px-4 sm:px-6 dark:border-zinc-800">
            <Dialog.Close asChild>
              <IconButton aria-label="Close prospect details">
                <X className="size-5" />
              </IconButton>
            </Dialog.Close>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                {prospect.name}
              </Dialog.Title>
              <Dialog.Description className="truncate text-xs text-zinc-500">
                {prospect.mode === "b2c"
                  ? `${prospect.consumer?.relationship} · recorded audience`
                  : `${prospect.title} at ${prospect.company}`}
              </Dialog.Description>
            </div>
            <StatusBadge
              tone={
                prospect.mode === "b2c"
                  ? visibleConsent
                    ? "success"
                    : "warning"
                  : prospect.status === "Verified"
                    ? "success"
                    : "warning"
              }
            >
              <ShieldCheck className="size-3" />
              {prospect.mode === "b2c"
                ? `${permissionLabel} permission`
                : prospect.status}
            </StatusBadge>
            {prospect.mode === "b2b" ? (
              <Link
                href={`/company/${encodeURIComponent(prospect.companyId ?? prospect.id)}`}
                onClick={() => onOpenChange(false)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Full report
                <ArrowUpRight className="size-3.5" />
              </Link>
            ) : null}
          </div>
          <div
            className="flex gap-1 border-b border-zinc-200 px-4 sm:px-6 dark:border-zinc-800"
            role="tablist"
            aria-label="Prospect panel"
          >
            <button
              role="tab"
              aria-selected={section === "insight"}
              onClick={() => setSection("insight")}
              className={cx(
                "min-h-11 border-b-2 px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-100",
                section === "insight"
                  ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-white",
              )}
            >
              Intelligence
            </button>
            <button
              role="tab"
              aria-selected={section === "outreach"}
              onClick={() => setSection("outreach")}
              className={cx(
                "min-h-11 border-b-2 px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-100",
                section === "outreach"
                  ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-white",
              )}
            >
              Outreach drafts
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {section === "insight" ? (
              <div role="tabpanel" className="space-y-7 p-4 sm:p-6">
                <section aria-labelledby="profile-heading">
                  <div className="flex items-start gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {prospect.name
                        .split(" ")
                        .map((name) => name[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="profile-heading"
                        className="text-lg font-semibold tracking-[-0.02em] text-zinc-950 dark:text-white"
                      >
                        {prospect.name}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {prospect.mode === "b2c"
                          ? `${prospect.consumer?.relationship} · ${prospect.consumer?.source}`
                          : `${prospect.title} · ${prospect.company}`}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {prospect.mode === "b2b" ? (
                          <StatusBadge
                            tone={
                              prospect.intent === "High" ? "warning" : "neutral"
                            }
                          >
                            <CircleDot className="size-3" />
                            {prospect.intent} buying intent
                          </StatusBadge>
                        ) : (
                          <StatusBadge
                            tone={visibleConsent ? "success" : "warning"}
                          >
                            <ShieldCheck className="size-3" />
                            {permissionLabel} permission
                          </StatusBadge>
                        )}
                        <StatusBadge>
                          {prospect.channel} recommended
                        </StatusBadge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="tabular-nums text-3xl font-semibold tracking-[-0.04em]">
                        {prospect.score}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {prospect.mode === "b2c"
                          ? "Relevance / 100"
                          : "AI score / 100"}
                      </p>
                    </div>
                  </div>
                  <dl className="mt-6 grid gap-5 rounded-xl bg-zinc-50 p-4 sm:grid-cols-3 dark:bg-zinc-900">
                    {prospect.mode === "b2c" ? (
                      <>
                        <Definition label="Relationship">
                          {prospect.consumer?.relationship}
                        </Definition>
                        <Definition label="Retention until">
                          {visibleConsent?.retentionUntil ??
                            (consentCheck === "pending"
                              ? "Current check pending"
                              : "Review required")}
                        </Definition>
                        <Definition label="Suppression checked">
                          {visibleConsent?.suppressionChecked ??
                            (consentCheck === "pending"
                              ? "Current check pending"
                              : "Review required")}
                        </Definition>
                      </>
                    ) : (
                      <>
                        <Definition label="Decision confidence">
                          {prospect.decisionConfidence}%
                        </Definition>
                        <Definition label="Company size">
                          {prospect.companySize}
                        </Definition>
                        <Definition label="Industry">
                          {prospect.industry}
                        </Definition>
                      </>
                    )}
                  </dl>
                </section>

                <Divider />
                <section aria-labelledby="summary-heading">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-blue-600 dark:text-blue-400" />
                    <h2
                      id="summary-heading"
                      className="text-sm font-semibold text-zinc-950 dark:text-white"
                    >
                      AI summary
                    </h2>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
                    {prospect.summary}
                  </p>
                </section>

                <section aria-labelledby="fit-heading">
                  <h2
                    id="fit-heading"
                    className="text-sm font-semibold text-zinc-950 dark:text-white"
                  >
                    {prospect.mode === "b2c"
                      ? "Why this record is included"
                      : "Why this is a good prospect"}
                  </h2>
                  <ul className="mt-3 space-y-2.5">
                    {prospect.reasons.map((reason) => (
                      <li
                        key={reason}
                        className="flex gap-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
                      >
                        <span className="mt-1.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white dark:bg-blue-400 dark:text-slate-950">
                          <Check className="size-2.5" />
                        </span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section
                  aria-labelledby="offer-heading"
                  className="rounded-xl bg-slate-900 p-5 text-white dark:border dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Target className="size-4 text-blue-300" />
                    <h2 id="offer-heading">
                      {prospect.mode === "b2c"
                        ? "Suggested invitation"
                        : "Suggested offer"}
                    </h2>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">
                    {prospect.offer}
                  </p>
                  <Button
                    size="sm"
                    className="mt-4 bg-blue-500 text-white hover:bg-blue-400 dark:bg-blue-500 dark:text-white"
                    onClick={() => setSection("outreach")}
                  >
                    Create a draft
                    <ChevronRight className="size-3.5" />
                  </Button>
                </section>

                <section aria-labelledby="company-heading">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2
                        id="company-heading"
                        className="text-sm font-semibold text-zinc-950 dark:text-white"
                      >
                        {prospect.mode === "b2c"
                          ? "Audience record and contact"
                          : "Company and contact"}
                      </h2>
                      <p className="mt-1 text-xs text-zinc-500">
                        {visibleContact
                          ? "Full authorized contact values are loaded. Missing values are shown as null."
                          : "Contact values require an authorized, audited reveal."}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={revealing}
                      disabled={
                        Boolean(visibleContact) ||
                        (prospect.mode === "b2c" && !visibleConsent)
                      }
                      onClick={() => void revealContact()}
                    >
                      <Eye className="size-3.5" />
                      {visibleContact
                        ? contactDetailsRevealed
                          ? "Full values loaded"
                          : "Revealed and audited"
                        : prospect.mode === "b2c" && !visibleConsent
                          ? consentCheck === "pending"
                            ? "Checking permission…"
                            : "Permission review required"
                          : "Reveal contact details"}
                    </Button>
                  </div>
                  {revealError ? (
                    <div className="mt-3">
                      <InlineNotice
                        title="Contact reveal blocked"
                        tone="danger"
                      >
                        <p>{revealError}</p>
                      </InlineNotice>
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {prospect.mode === "b2b" ? (
                      <>
                        {prospect.website ? (
                          <a
                            href={prospect.website}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-700 outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:focus-visible:ring-zinc-100"
                          >
                            <Globe2 className="size-4" />
                            <span className="min-w-0 flex-1 break-all">
                              {prospect.website.replace(/^https?:\/\//, "")}
                            </span>
                            <ArrowUpRight className="size-3.5" />
                          </a>
                        ) : (
                          <div className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-500 dark:border-zinc-800">
                            <Globe2 className="size-4" />
                            <span className="font-mono text-xs">null</span>
                          </div>
                        )}
                        {visibleLinkedin !== "null" ? (
                          <a
                            href={visibleLinkedin}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-700 outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:focus-visible:ring-zinc-100"
                          >
                            <Linkedin className="size-4" />
                            <span className="min-w-0 flex-1 break-all">
                              LinkedIn profile
                            </span>
                            <ArrowUpRight className="size-3.5" />
                          </a>
                        ) : (
                          <div className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-500 dark:border-zinc-800">
                            <Linkedin className="size-4" />
                            <span className="font-mono text-xs">null</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                          <Database className="size-4" />
                          <span className="min-w-0 flex-1 truncate">
                            {prospect.consumer?.source}
                          </span>
                        </div>
                        <div className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                          <CalendarClock className="size-4" />
                          <span className="min-w-0 flex-1 truncate">
                            Collected {prospect.consumer?.collectedAt}
                          </span>
                        </div>
                      </>
                    )}
                    {visibleContact ? (
                      visibleEmail === "null" ? (
                        <div className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-500 dark:border-zinc-800">
                          <Mail className="size-4" />
                          <span className="font-mono text-xs">null</span>
                        </div>
                      ) : (
                        <a
                          href={`mailto:${visibleEmail}`}
                          className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-blue-700 outline-none hover:bg-zinc-50 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:text-blue-400 dark:hover:bg-zinc-900 dark:focus-visible:ring-zinc-100"
                        >
                          <Mail className="size-4 shrink-0" />
                          <span className="min-w-0 flex-1 break-all">
                            {visibleEmail}
                          </span>
                        </a>
                      )
                    ) : (
                      <div className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-500 dark:border-zinc-800">
                        <Mail className="size-4" />
                        <span>Masked — reveal required</span>
                      </div>
                    )}
                    {visibleContact ? (
                      visiblePhone === "null" ? (
                        <div className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-500 dark:border-zinc-800">
                          <Phone className="size-4" />
                          <span className="font-mono text-xs">null</span>
                        </div>
                      ) : (
                        <a
                          href={`tel:${visiblePhone}`}
                          className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-blue-700 outline-none hover:bg-zinc-50 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:text-blue-400 dark:hover:bg-zinc-900 dark:focus-visible:ring-zinc-100"
                        >
                          <Phone className="size-4 shrink-0" />
                          <span className="min-w-0 flex-1 break-all">
                            {visiblePhone}
                          </span>
                        </a>
                      )
                    ) : (
                      <div className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-500 dark:border-zinc-800">
                        <Phone className="size-4" />
                        <span>Masked — reveal required</span>
                      </div>
                    )}
                  </div>
                </section>

                {prospect.mode === "b2b" ? (
                  <section aria-labelledby="complete-record-heading">
                    <h2
                      id="complete-record-heading"
                      className="text-sm font-semibold text-zinc-950 dark:text-white"
                    >
                      Complete Apify lead record
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      All 36 Leads Finder fields, grouped by purpose. Missing
                      values are shown explicitly as null.
                    </p>
                    <div className="mt-4 space-y-4">
                      {LEAD_COLUMN_GROUPS.map((group) => (
                        <section
                          key={group.label}
                          aria-label={group.label}
                          className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                        >
                          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-600 dark:text-zinc-400">
                            {group.label}
                          </h3>
                          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                            {group.keys.map((columnKey) => (
                              <LeadFieldDefinition
                                key={columnKey}
                                columnKey={columnKey}
                                value={completeLeadValue(columnKey)}
                              />
                            ))}
                          </dl>
                        </section>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section aria-labelledby="evidence-heading">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h2
                        id="evidence-heading"
                        className="text-sm font-semibold text-zinc-950 dark:text-white"
                      >
                        Evidence and provenance
                      </h2>
                      <p className="mt-1 text-xs text-zinc-500">
                        Why the score says what it says
                      </p>
                    </div>
                    <StatusBadge tone="info">
                      <Database className="size-3" />3 sources
                    </StatusBadge>
                  </div>
                  <div className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                    {prospect.evidence.map((item) => (
                      <div key={item.label} className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                              {item.label}
                            </p>
                            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                              {item.value}
                            </p>
                          </div>
                          <span className="tabular-nums shrink-0 text-xs font-medium">
                            {item.confidence}% confidence
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <Database className="size-3" />
                            {item.source}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3" />
                            {item.freshness}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <InlineNotice
                  title={
                    prospect.mode === "b2c"
                      ? "Purpose and permission controls"
                      : "Data use and verification"
                  }
                  tone={prospect.mode === "b2c" ? "warning" : "neutral"}
                  icon={<ShieldCheck className="size-4" />}
                >
                  <p>
                    {prospect.mode === "b2c"
                      ? visibleConsent
                        ? `Use this record only to ${visibleConsent.purpose.toLowerCase()}. Reconfirm permission before contact, honor opt-outs immediately, and delete the record by ${visibleConsent.retentionUntil}.`
                        : "Recorded permission evidence has not passed the current purpose, expiry, suppression, and retention checks. Do not use a contact channel until this record is confirmed."
                      : "Contact details are for authorized, individualized business use. Recheck source accuracy and respect applicable privacy rights, suppression lists, and channel rules before outreach."}
                  </p>
                </InlineNotice>

                <section aria-labelledby="notes-heading">
                  <div className="flex items-center justify-between gap-3">
                    <h2
                      id="notes-heading"
                      className="text-sm font-semibold text-zinc-950 dark:text-white"
                    >
                      Notes in this browser
                    </h2>
                    {saved ? (
                      <StatusBadge tone="success">
                        <Check className="size-3" />
                        Saved locally
                      </StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    These notes stay in this browser only. They are not synced
                    to the workspace, shared with teammates, or backed up.
                  </p>
                  <label htmlFor="lead-notes" className="sr-only">
                    Local notes about {prospect.name}
                  </label>
                  <textarea
                    id="lead-notes"
                    rows={4}
                    value={notes}
                    onChange={(event) => {
                      setNotes(event.target.value);
                      setSaved(false);
                    }}
                    placeholder="Add private context for this browser…"
                    className="mt-3 w-full resize-y rounded-lg border border-zinc-300 bg-white p-3 text-sm leading-6 text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-white"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={saveNote}
                  >
                    <Save className="size-3.5" />
                    Save in this browser
                  </Button>
                </section>
              </div>
            ) : (
              <div role="tabpanel" className="p-4 sm:p-6">
                <OutreachGenerator prospect={safeOutreachProspect} />
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
