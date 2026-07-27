"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronRight,
  CircleAlert,
  Clipboard,
  Code2,
  Download,
  ExternalLink,
  FileSearch,
  Gauge,
  Globe2,
  Layers3,
  Linkedin,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  Radar,
  RefreshCw,
  SearchCheck,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundSearch,
  WandSparkles,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildDemoCompanyIntelligence } from "@/lib/intelligence/demo";
import type {
  CompanyChatAnswer,
  CompanyIntelligence,
} from "@/lib/intelligence/types";
import { requestOrFallback } from "@/lib/demo/client";
import {
  Button,
  EmptyState,
  StatusBadge,
  Surface,
  cx,
} from "@/components/product/ui";

const sectionLinks = [
  ["overview", "Overview"],
  ["website", "Website"],
  ["signals", "Signals"],
  ["people", "People"],
  ["strategy", "Strategy"],
  ["timeline", "Timeline"],
  ["outreach", "Outreach"],
  ["evidence", "Evidence"],
] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreTone(score: number) {
  if (score >= 82) return "text-emerald-300";
  if (score >= 65) return "text-blue-300";
  return "text-rose-300";
}

function ScoreRing({
  value,
  label,
  size = "lg",
}: {
  value: number;
  label: string;
  size?: "sm" | "lg";
}) {
  return (
    <div
      className={cx(
        "relative grid shrink-0 place-items-center rounded-full",
        size === "lg" ? "size-32" : "size-16",
      )}
      style={{
        background: `conic-gradient(rgb(59 130 246) ${value * 3.6}deg, rgb(51 65 85 / .6) 0deg)`,
      }}
      role="img"
      aria-label={`${label}: ${value} out of 100`}
    >
      <div
        className={cx(
          "grid place-items-center rounded-full bg-zinc-950",
          size === "lg" ? "size-[7.15rem]" : "size-14",
        )}
      >
        <span
          className={cx(
            "font-semibold tracking-[-0.05em] text-white",
            size === "lg" ? "text-4xl" : "text-lg",
          )}
        >
          {value}
        </span>
        {size === "lg" ? (
          <span className="-mt-5 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div className="group rounded-xl border border-slate-700/70 bg-slate-900/70 p-4 transition-colors hover:border-blue-500/30">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-zinc-500">{label}</p>
        <span
          className={cx(
            "font-mono text-sm font-medium tabular-nums",
            scoreTone(value),
          )}
        >
          {value}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${value}%` }}
        />
      </div>
      {detail ? (
        <p className="mt-2 text-[11px] leading-4 text-zinc-600">{detail}</p>
      ) : null}
    </div>
  );
}

function EvidenceRefs({
  refs,
  evidence,
}: {
  refs: string[];
  evidence: CompanyIntelligence["evidence"];
}) {
  if (!refs.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {refs.map((reference) => {
        const item = evidence.find(
          (candidate) =>
            candidate.id === reference || candidate.reference === reference,
        );
        return (
          <a
            key={reference}
            href={`#evidence-${item?.id ?? reference}`}
            className="inline-flex min-h-7 items-center gap-1 rounded-full border border-blue-400/15 bg-blue-400/[0.08] px-2 text-[10px] font-medium text-blue-200 transition hover:border-blue-300/30 hover:bg-blue-400/[0.14]"
          >
            <SearchCheck className="size-3" />
            {item?.label ?? reference}
          </a>
        );
      })}
    </div>
  );
}

function IntelligenceSection({
  id,
  eyebrow,
  title,
  description,
  icon,
  action,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-300">
            {icon}
            {eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
  evidenceRefs?: string[];
  confidence?: number;
};

function CompanyChat({ company }: { company: CompanyIntelligence }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      body: `I can analyze ${company.name} from the retained research evidence. Ask about fit, pain points, decision-makers, buying signals, or a proposal.`,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const suggestions = [
    "What services can I sell?",
    "Who should I contact?",
    "Why should I contact them now?",
    "Summarize the strongest pain points.",
  ];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const ask = async (value = question) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      body: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setLoading(true);
    try {
      const response = await fetch(
        `/api/company/${encodeURIComponent(company.id)}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed }),
        },
      );
      const payload = (await response.json()) as {
        data?: CompanyChatAnswer;
        error?: { message?: string };
      };
      if (!response.ok || !payload.data) {
        throw new Error(
          payload.error?.message ?? "The analyst is unavailable.",
        );
      }
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          body: payload.data!.answer,
          evidenceRefs: payload.data!.evidenceRefs,
          confidence: payload.data!.confidence,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          body:
            error instanceof Error
              ? error.message
              : "The analyst is unavailable.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-blue-400/20 bg-slate-950/95 shadow-[0_20px_60px_rgba(0,0,0,.24)] backdrop-blur-xl">
      <div className="border-b border-slate-800 bg-blue-500/[0.06] p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-blue-500 text-white">
            <Bot className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Ask Athreix</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Answers cite retained evidence
            </p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Evidence mode
          </span>
        </div>
      </div>
      <div className="max-h-[28rem] space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cx(
              "rounded-2xl px-3.5 py-3 text-xs leading-5",
              message.role === "user"
                ? "ml-7 bg-white text-zinc-950"
                : "mr-4 border border-white/8 bg-white/[0.045] text-zinc-300",
            )}
          >
            <p className="whitespace-pre-wrap">{message.body}</p>
            {message.evidenceRefs?.length ? (
              <EvidenceRefs
                refs={message.evidenceRefs}
                evidence={company.evidence}
              />
            ) : null}
            {message.confidence !== undefined ? (
              <p className="mt-2 text-[10px] text-zinc-600">
                {message.confidence}% answer confidence
              </p>
            ) : null}
          </div>
        ))}
        {loading ? (
          <div className="mr-4 flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.045] px-3.5 py-3 text-xs text-zinc-500">
            <LoaderCircle className="size-3.5 animate-spin" />
            Reading evidence…
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <div className="border-t border-white/8 p-3">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => void ask(suggestion)}
              className="whitespace-nowrap rounded-md border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-400 transition hover:border-blue-500/40 hover:text-blue-300"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask();
          }}
          className="flex items-end gap-2 rounded-lg border border-slate-700 bg-slate-900/70 p-2 focus-within:border-blue-500/50"
        >
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask();
              }
            }}
            rows={2}
            placeholder="Ask about this company…"
            className="min-h-10 flex-1 resize-none bg-transparent px-1 py-1 text-xs leading-5 text-white outline-none placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={!question.trim() || loading}
            aria-label="Send question"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-500 text-white transition hover:bg-blue-400 disabled:opacity-40"
          >
            <Send className="size-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CompanyIntelligencePage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [company, setCompany] = useState<CompanyIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [outreachView, setOutreachView] =
    useState<keyof CompanyIntelligence["outreach"]>("coldEmail");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let active = true;
    const fallback = { data: buildDemoCompanyIntelligence(id) };
    requestOrFallback<{ data: CompanyIntelligence }>(
      `/api/company/${encodeURIComponent(id)}`,
      fallback,
    )
      .then(({ data }) => {
        if (!active) return;
        setCompany(data.data);
        setLoading(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Company intelligence could not be loaded.",
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const outreachText = useMemo(() => {
    if (!company) return "";
    const value = company.outreach[outreachView];
    return typeof value === "string"
      ? value
      : `${value.subject}\n\n${value.body}`;
  }, [company, outreachView]);

  if (loading) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl border border-blue-400/20 bg-blue-400/[0.08] text-blue-300">
            <Radar className="size-5 animate-pulse" />
          </span>
          <p className="mt-4 text-sm text-zinc-400">
            Assembling company intelligence…
          </p>
        </div>
      </div>
    );
  }

  if (!company || error) {
    return (
      <Surface className="border-slate-800 bg-slate-900/70">
        <EmptyState
          icon={<CircleAlert className="size-5" />}
          title="Company intelligence unavailable"
          description={error || "This company report could not be loaded."}
          action={
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" />
              Try again
            </Button>
          }
        />
      </Surface>
    );
  }

  const initials = company.name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("");
  const scoreEntries = [
    ["Website", company.scores.website],
    ["Technology", company.scores.technology],
    ["Business growth", company.scores.businessGrowth],
    ["Buying intent", company.scores.buyingIntent],
    ["Digital maturity", company.scores.digitalMaturity],
    ["Decision-makers", company.scores.decisionMakers],
  ] as const;

  return (
    <div className="-mx-4 -my-6 min-h-dvh bg-slate-950 text-white sm:-mx-6 sm:-my-8 lg:-mx-8">
      <div className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto max-w-[1500px] px-4 pb-7 pt-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Link
              href="/companies"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <ArrowLeft className="size-3.5" />
              Intelligence
            </Link>
            <ChevronRight className="size-3 text-zinc-700" />
            <span className="text-zinc-300">{company.name}</span>
            <span className="ml-auto flex items-center gap-2 text-[10px] text-zinc-500">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.7)]" />
              Researched {formatDate(company.lastResearchedAt)}
            </span>
          </div>

          <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-4 sm:gap-5">
              <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-lg font-semibold text-blue-200 sm:size-16">
                {initials}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                    {company.name}
                  </h1>
                  <StatusBadge tone="success">
                    <Check className="size-3" />
                    Research complete
                  </StatusBadge>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                  {company.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
                  {company.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" />
                      {company.location}
                    </span>
                  ) : null}
                  {company.industry ? (
                    <span className="inline-flex items-center gap-1.5">
                      <BriefcaseBusiness className="size-3.5" />
                      {company.industry}
                    </span>
                  ) : null}
                  {company.employeeRange ? (
                    <span>{company.employeeRange} employees</span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {company.website ? (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/70 px-3 text-xs font-medium text-slate-300 transition hover:border-blue-500/40 hover:bg-slate-800 hover:text-white"
                >
                  <Globe2 className="size-3.5" />
                  Visit website
                  <ArrowUpRight className="size-3" />
                </a>
              ) : null}
              <Button
                className="rounded-lg bg-blue-500 text-white hover:bg-blue-400"
                onClick={() => window.print()}
              >
                <Download className="size-4" />
                AI report
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur-lg">
        <nav
          aria-label="Company intelligence sections"
          className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8"
        >
          {sectionLinks.map(([href, label]) => (
            <a
              key={href}
              href={`#${href}`}
              className="whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      <main className="mx-auto grid max-w-[1500px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8">
        <div className="min-w-0 space-y-14">
          <IntelligenceSection
            id="overview"
            eyebrow="AI executive brief"
            title="Why this account matters"
            description="A decision-ready summary grounded in the latest retained research."
            icon={<Sparkles className="size-3.5" />}
          >
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 shadow-[0_16px_50px_rgba(0,0,0,.18)]">
              <div className="grid gap-7 p-5 sm:p-7 xl:grid-cols-[9rem_minmax(0,1fr)]">
                <ScoreRing value={company.scores.overall} label="Lead score" />
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone="warning">
                      <Zap className="size-3" />
                      {company.scores.buyingIntent >= 82
                        ? "High buying intent"
                        : "Developing intent"}
                    </StatusBadge>
                    <StatusBadge tone="info">
                      <ShieldCheck className="size-3" />
                      {company.scores.confidence}% confidence
                    </StatusBadge>
                  </div>
                  <p className="mt-5 text-lg leading-8 text-zinc-200">
                    {company.summary.oneLiner}
                  </p>
                  <div className="mt-5 rounded-xl border border-blue-400/20 bg-blue-400/[0.06] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300">
                      Next best action
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-200">
                      {company.salesStrategy.bestApproach}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-px border-t border-white/8 bg-white/8 sm:grid-cols-3">
                {[
                  ["Business model", company.summary.businessModel],
                  [
                    "Best decision-maker",
                    company.decisionMakers[0]
                      ? `${company.decisionMakers[0].name} · ${company.decisionMakers[0].role}`
                      : "Needs research",
                  ],
                  [
                    "Best opportunity",
                    company.salesStrategy.recommendedServices[0] ??
                      "Validate account needs",
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="bg-slate-950/60 p-5">
                    <p className="text-[10px] uppercase tracking-[0.13em] text-zinc-600">
                      {label}
                    </p>
                    <p className="mt-2 text-sm leading-5 text-zinc-300">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {scoreEntries.map(([label, value]) => (
                <Metric key={label} label={label} value={value} />
              ))}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {[
                ["Products", company.summary.products],
                ["Target customers", company.summary.targetCustomers],
                ["Strengths", company.summary.strengths],
              ].map(([label, values]) => (
                <div
                  key={label as string}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
                >
                  <h3 className="text-xs font-semibold text-white">{label}</h3>
                  <ul className="mt-3 space-y-2.5">
                    {(values as string[]).map((value) => (
                      <li
                        key={value}
                        className="flex gap-2 text-xs leading-5 text-zinc-400"
                      >
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
                        {value}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </IntelligenceSection>

          <IntelligenceSection
            id="website"
            eyebrow="Digital experience"
            title="Website intelligence"
            description="Homepage, UX, content, technical quality, accessibility, and conversion opportunities."
            icon={<Globe2 className="size-3.5" />}
            action={
              <StatusBadge tone="info">
                {company.websiteAnalysis.analyzedPages.length} pages analyzed
              </StatusBadge>
            }
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,.85fr)]">
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
                <div className="flex h-11 items-center gap-2 border-b border-white/8 px-4">
                  <span className="size-2.5 rounded-full bg-rose-400/70" />
                  <span className="size-2.5 rounded-full bg-blue-400/80" />
                  <span className="size-2.5 rounded-full bg-emerald-400/70" />
                  <span className="ml-3 truncate rounded-lg bg-white/5 px-3 py-1 text-[10px] text-zinc-600">
                    {company.domain}
                  </span>
                </div>
                <div
                  className="relative min-h-[22rem] overflow-hidden bg-[#111]"
                  style={
                    company.screenshotUrl
                      ? {
                          backgroundImage: `url("${company.screenshotUrl}")`,
                          backgroundPosition: "top center",
                          backgroundSize: "cover",
                        }
                      : undefined
                  }
                >
                  {!company.screenshotUrl ? (
                    <div className="absolute inset-0 p-7">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(251,191,36,.16),transparent_35%),linear-gradient(135deg,#171717,#0a0a0a)]" />
                      <div className="relative">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            {company.name}
                          </span>
                          <div className="flex gap-4 text-[9px] text-zinc-500">
                            <span>Product</span>
                            <span>Solutions</span>
                            <span>Customers</span>
                          </div>
                        </div>
                        <div className="mt-14 max-w-sm">
                          <span className="rounded-md border border-blue-400/20 bg-blue-400/[0.08] px-2 py-1 text-[9px] text-blue-300">
                            Enterprise workflow intelligence
                          </span>
                          <div className="mt-5 h-7 w-4/5 rounded bg-white/90" />
                          <div className="mt-2 h-7 w-3/5 rounded bg-white/90" />
                          <div className="mt-5 h-2 w-full rounded bg-white/12" />
                          <div className="mt-2 h-2 w-4/5 rounded bg-white/8" />
                          <div className="mt-8 flex gap-2">
                            <div className="h-9 w-28 rounded-lg bg-blue-500" />
                            <div className="h-9 w-24 rounded-lg border border-white/10" />
                          </div>
                        </div>
                        <div className="absolute right-2 top-20 grid w-40 grid-cols-2 gap-2">
                          {[75, 45, 62, 88].map((height, cardIndex) => (
                            <div
                              key={height}
                              className="rounded-xl border border-white/8 bg-white/[0.04] p-2"
                            >
                              <div className="h-1.5 w-8 rounded bg-white/12" />
                              <div
                                className="mt-3 rounded bg-blue-400/30"
                                style={{ height: `${height / 2}px` }}
                              />
                              <span className="mt-2 block text-[7px] text-zinc-600">
                                Signal {cardIndex + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1.5 text-[10px] text-zinc-400 backdrop-blur">
                    <FileSearch className="size-3 text-blue-300" />
                    Latest Apify website snapshot
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <ScoreRing
                    value={company.scores.website}
                    label="Website"
                    size="sm"
                  />
                  <div>
                    <p className="text-sm font-semibold">Website score</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      Composite of experience, quality, accessibility, SEO, and
                      conversion.
                    </p>
                  </div>
                </div>
                {[
                  ["SEO", company.scores.seo],
                  ["Accessibility", company.scores.accessibility],
                  ["Performance", company.scores.performance],
                  ["Branding", company.scores.branding],
                ].map(([label, value]) => (
                  <Metric
                    key={label}
                    label={label as string}
                    value={value as number}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {company.websiteAnalysis.issues.map((issue) => (
                <div
                  key={issue.title}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cx(
                        "mt-0.5 size-2 shrink-0 rounded-full",
                        issue.severity === "critical" ||
                          issue.severity === "high"
                          ? "bg-rose-400"
                          : "bg-blue-500",
                      )}
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">
                          {issue.title}
                        </h3>
                        <span className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">
                          {issue.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">
                        {issue.businessImpact}
                      </p>
                      <EvidenceRefs
                        refs={issue.evidenceRefs}
                        evidence={company.evidence}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.035] p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <WandSparkles className="size-4 text-emerald-300" />
                Recommended digital opportunities
              </h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {company.websiteAnalysis.recommendations.map(
                  (recommendation) => (
                    <div
                      key={recommendation.title}
                      className="rounded-xl border border-white/8 bg-black/15 p-4"
                    >
                      <p className="text-xs font-semibold text-zinc-200">
                        {recommendation.title}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-zinc-500">
                        {recommendation.outcome}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
          </IntelligenceSection>

          <IntelligenceSection
            id="signals"
            eyebrow="Opportunity timing"
            title="Buying signals and pain points"
            description="What changed, why it matters, and what the evidence actually supports."
            icon={<TrendingUp className="size-3.5" />}
          >
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="space-y-3">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-500">
                  <Radar className="size-3.5" />
                  Buying signals
                </h3>
                {company.buyingSignals.map((signal) => (
                  <div
                    key={signal.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.5)]" />
                          <span className="text-[10px] uppercase tracking-[0.13em] text-emerald-300">
                            {signal.type}
                          </span>
                        </div>
                        <h3 className="mt-3 text-sm font-semibold">
                          {signal.title}
                        </h3>
                      </div>
                      <span className="font-mono text-xs text-zinc-500">
                        {signal.confidence}%
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-400">
                      {signal.detail}
                    </p>
                    <EvidenceRefs
                      refs={signal.evidenceRefs}
                      evidence={company.evidence}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-500">
                  <Target className="size-3.5" />
                  Evidence-backed pain points
                </h3>
                {company.painPoints.map((point) => (
                  <div
                    key={point.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.13em] text-rose-300">
                          {point.category}
                        </span>
                        <h3 className="mt-2 text-sm font-semibold">
                          {point.title}
                        </h3>
                      </div>
                      <span className="rounded-full bg-rose-400/10 px-2 py-1 text-[9px] uppercase text-rose-300">
                        {point.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-400">
                      {point.problem}
                    </p>
                    <p className="mt-3 border-l border-blue-400/30 pl-3 text-[11px] leading-5 text-zinc-500">
                      {point.businessImpact}
                    </p>
                    <EvidenceRefs
                      refs={point.evidenceRefs}
                      evidence={company.evidence}
                    />
                  </div>
                ))}
              </div>
            </div>
          </IntelligenceSection>

          <IntelligenceSection
            id="technology"
            eyebrow="Digital foundation"
            title="Technology intelligence"
            description="Publicly detected frameworks, platforms, cloud services, analytics, and operational tooling."
            icon={<Code2 className="size-3.5" />}
          >
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6">
              <div className="flex flex-wrap gap-2">
                {company.technologies.map((technology) => (
                  <div
                    key={`${technology.category}-${technology.name}`}
                    className="group flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3.5 py-3 transition hover:border-blue-400/30"
                  >
                    <span className="grid size-7 place-items-center rounded-lg bg-white/5 text-zinc-400 group-hover:text-blue-300">
                      <Layers3 className="size-3.5" />
                    </span>
                    <span>
                      <span className="block text-xs font-medium text-zinc-200">
                        {technology.name}
                      </span>
                      <span className="mt-0.5 block text-[9px] uppercase tracking-[0.12em] text-zinc-600">
                        {technology.category} · {technology.confidence}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Technology maturity"
                  value={company.summary.technologyMaturity}
                />
                <Metric
                  label="AI readiness"
                  value={company.summary.aiReadiness}
                />
                <Metric
                  label="Digital maturity"
                  value={company.scores.digitalMaturity}
                />
              </div>
            </div>
          </IntelligenceSection>

          <IntelligenceSection
            id="people"
            eyebrow="Decision intelligence"
            title="Who to contact"
            description="Public professional roles ranked by relevance, evidence quality, and likely ownership of the opportunity."
            icon={<UserRoundSearch className="size-3.5" />}
          >
            <div className="grid gap-4 lg:grid-cols-3">
              {company.decisionMakers.map((person, personIndex) => (
                <div
                  key={person.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
                >
                  <div className="flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-xl border border-blue-400/15 bg-blue-400/[0.08] text-sm font-semibold text-blue-200">
                      {person.name
                        .split(" ")
                        .map((word) => word[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    {personIndex === 0 ? (
                      <StatusBadge tone="success">Best contact</StatusBadge>
                    ) : null}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{person.name}</h3>
                  <p className="mt-1 text-xs text-blue-300">{person.role}</p>
                  <p className="mt-3 text-[11px] leading-5 text-zinc-500">
                    {person.reasonToContact}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="font-mono text-xs text-emerald-300">
                      {person.confidence}%
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      role confidence
                    </span>
                    {person.publicProfile ? (
                      <a
                        href={person.publicProfile}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${person.name} public profile`}
                        className="ml-auto grid size-8 place-items-center rounded-lg border border-white/8 text-zinc-500 hover:text-white"
                      >
                        <Linkedin className="size-3.5" />
                      </a>
                    ) : null}
                  </div>
                  <EvidenceRefs
                    refs={person.evidenceRefs}
                    evidence={company.evidence}
                  />
                </div>
              ))}
            </div>
          </IntelligenceSection>

          <IntelligenceSection
            id="strategy"
            eyebrow="AI sales strategy"
            title="How to win this account"
            description="A practical approach connected to observed needs—not a generic pitch."
            icon={<Target className="size-3.5" />}
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="rounded-xl border border-blue-400/20 bg-blue-400/[0.06] p-5 sm:p-7">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300">
                  Recommended approach
                </p>
                <p className="mt-4 text-base leading-7 text-zinc-200">
                  {company.salesStrategy.bestApproach}
                </p>
                <div className="mt-6 space-y-3">
                  {company.salesStrategy.channelPlan.map((channel) => (
                    <div
                      key={channel.channel}
                      className="flex gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 font-mono text-xs text-blue-300">
                        {channel.priority}
                      </span>
                      <div>
                        <p className="text-xs font-semibold">
                          {channel.channel}
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                          {channel.angle}
                        </p>
                        <EvidenceRefs
                          refs={channel.evidenceRefs}
                          evidence={company.evidence}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                  <h3 className="text-xs font-semibold">Services to propose</h3>
                  <ol className="mt-4 space-y-3">
                    {company.salesStrategy.recommendedServices.map(
                      (service, serviceIndex) => (
                        <li
                          key={service}
                          className="flex gap-3 text-xs leading-5 text-zinc-400"
                        >
                          <span className="font-mono text-blue-300">
                            0{serviceIndex + 1}
                          </span>
                          {service}
                        </li>
                      ),
                    )}
                  </ol>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                  <h3 className="text-xs font-semibold">Why it should work</h3>
                  <p className="mt-3 text-[11px] leading-5 text-zinc-500">
                    {company.salesStrategy.whyItWillWork}
                  </p>
                </div>
                {company.salesStrategy.risks.length ? (
                  <div className="rounded-xl border border-rose-300/10 bg-rose-300/[0.025] p-5">
                    <h3 className="text-xs font-semibold text-rose-200">
                      Validate first
                    </h3>
                    <ul className="mt-3 space-y-2 text-[11px] leading-5 text-zinc-500">
                      {company.salesStrategy.risks.map((risk) => (
                        <li key={risk}>• {risk}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </IntelligenceSection>

          <IntelligenceSection
            id="timeline"
            eyebrow="Activity history"
            title="Company timeline"
            description="A chronological view of observed public activity and research events."
            icon={<CalendarClock className="size-3.5" />}
          >
            <ol className="relative ml-3 border-l border-white/10">
              {company.timeline.map((event, eventIndex) => (
                <li key={event.id} className="relative pb-8 pl-8 last:pb-0">
                  <span
                    className={cx(
                      "absolute -left-[5px] top-1 size-2.5 rounded-full border-2 border-[#090909]",
                      eventIndex === 0 ? "bg-blue-400" : "bg-zinc-600",
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <time className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                      {formatDate(event.occurredAt)}
                    </time>
                    <span className="text-[10px] text-zinc-700">·</span>
                    <span className="text-[10px] text-emerald-300">
                      {event.confidence}% confidence
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold">{event.title}</h3>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
                    {event.detail}
                  </p>
                  <EvidenceRefs
                    refs={event.evidenceRefs}
                    evidence={company.evidence}
                  />
                </li>
              ))}
            </ol>
          </IntelligenceSection>

          <IntelligenceSection
            id="outreach"
            eyebrow="Personalized outreach"
            title="AI outreach studio"
            description="Channel-specific drafts generated from the company evidence and intended for manual review."
            icon={<MessageSquareText className="size-3.5" />}
          >
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
              <div className="flex gap-1 overflow-x-auto border-b border-white/8 p-2">
                {(
                  [
                    ["coldEmail", "Cold email"],
                    ["linkedinMessage", "LinkedIn"],
                    ["followUpEmail", "Follow-up"],
                    ["meetingInvitation", "Meeting"],
                    ["websiteAudit", "Audit"],
                    ["proposal", "Proposal"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setOutreachView(key)}
                    className={cx(
                      "whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition",
                      outreachView === key
                        ? "bg-white text-zinc-950"
                        : "text-zinc-500 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {label}
                  </button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-zinc-400"
                  onClick={async () => {
                    await navigator.clipboard.writeText(outreachText);
                    setCopied(outreachView);
                    window.setTimeout(() => setCopied(""), 1600);
                  }}
                >
                  {copied === outreachView ? (
                    <Check className="size-3.5 text-emerald-300" />
                  ) : (
                    <Clipboard className="size-3.5" />
                  )}
                  {copied === outreachView ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="min-h-64 p-5 sm:p-7">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-zinc-300">
                  {outreachText}
                </pre>
              </div>
              <div className="flex items-start gap-2 border-t border-slate-800 bg-blue-400/[0.04] px-5 py-4 text-[11px] leading-5 text-zinc-500">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-blue-300" />
                Draft only. Recheck the cited evidence, relevance, permission,
                and channel rules before individual use.
              </div>
            </div>
          </IntelligenceSection>

          <IntelligenceSection
            id="industry"
            eyebrow="Market context"
            title="Industry intelligence"
            description="How this company’s digital maturity and opportunity fit the wider market."
            icon={<BarChart3 className="size-3.5" />}
          >
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["Overview", company.industryInsights.overview],
                ["Growth", company.industryInsights.growth],
                ["Competition", company.industryInsights.competition],
                [
                  "Technology adoption",
                  company.industryInsights.technologyAdoption,
                ],
              ].map(([label, body]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
                >
                  <h3 className="text-xs font-semibold">{label}</h3>
                  <p className="mt-3 text-xs leading-6 text-zinc-500">{body}</p>
                </div>
              ))}
            </div>
          </IntelligenceSection>

          <IntelligenceSection
            id="evidence"
            eyebrow="Trust layer"
            title="Evidence and provenance"
            description="Every source, timestamp, reference, and confidence score retained for this dossier."
            icon={<ShieldCheck className="size-3.5" />}
            action={
              <StatusBadge tone="success">
                {company.evidence.length} retained sources
              </StatusBadge>
            }
          >
            <div className="overflow-hidden rounded-xl border border-slate-800">
              {company.evidence.map((item, evidenceIndex) => (
                <article
                  key={item.id}
                  id={`evidence-${item.id}`}
                  className={cx(
                    "scroll-mt-28 p-5 transition target:bg-blue-400/[0.06] sm:p-6",
                    evidenceIndex > 0 && "border-t border-white/8",
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-blue-300/10 bg-blue-300/[0.055] text-blue-300">
                      <FileSearch className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{item.label}</h3>
                        <StatusBadge tone="info">
                          {item.confidence}% confidence
                        </StatusBadge>
                      </div>
                      <p className="mt-2 text-xs leading-6 text-zinc-400">
                        {item.excerpt}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-zinc-600">
                        <span>{item.source}</span>
                        <span>{formatDate(item.observedAt)}</span>
                        <code className="font-mono">{item.reference}</code>
                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-zinc-500 hover:text-white"
                          >
                            Open source
                            <ExternalLink className="size-2.5" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </IntelligenceSection>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <CompanyChat company={company} />
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold">
              <Gauge className="size-3.5 text-blue-300" />
              Research quality
            </h2>
            <dl className="mt-4 space-y-3 text-[11px]">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-600">Evidence confidence</dt>
                <dd className="font-mono text-emerald-300">
                  {company.scores.confidence}%
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-600">Sources retained</dt>
                <dd className="font-mono text-zinc-300">
                  {company.evidence.length}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-600">Pages analyzed</dt>
                <dd className="font-mono text-zinc-300">
                  {company.websiteAnalysis.analyzedPages.length}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </main>
    </div>
  );
}
