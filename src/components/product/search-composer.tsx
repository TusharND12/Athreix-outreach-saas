"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  CircleMinus,
  Database,
  Globe2,
  Landmark,
  LoaderCircle,
  Mail,
  MapPin,
  Search,
  SendHorizontal,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Tags,
  TrendingUp,
  WandSparkles,
  UsersRound,
} from "lucide-react";
import { ApiRequestError, requestOrFallback } from "@/lib/demo/client";
import { requestedLeadCountFromBrief } from "@/lib/leads/requested-count";
import type { SearchUnderstanding } from "@/server/intelligence/schemas";
import {
  Button,
  Field,
  InlineNotice,
  SelectField,
  StatusBadge,
  Surface,
  cx,
} from "./ui";

type SearchForm = {
  runLabel: string;
  industry: string;
  location: string;
  excludedLocation: string;
  companySize: string;
  jobTitle: string;
  emailRequirement: "ANY" | "AVAILABLE";
  websiteRequirement: "ANY" | "PRESENT" | "MISSING";
  keywords: string;
  technologies: string;
  revenueMin: string;
  revenueMax: string;
  foundedAfter: string;
  foundedBefore: string;
  funding: string;
  hiring: boolean;
  score: string;
};

const initialForm: SearchForm = {
  runLabel: "",
  industry: "",
  location: "",
  excludedLocation: "",
  companySize: "",
  jobTitle: "",
  emailRequirement: "ANY",
  websiteRequirement: "ANY",
  keywords: "",
  technologies: "",
  revenueMin: "",
  revenueMax: "",
  foundedAfter: "",
  foundedBefore: "",
  funding: "",
  hiring: false,
  score: "65",
};

const standardCompanySizes = [
  "1–20",
  "20–200",
  "201–500",
  "501–1,000",
  "1,000+",
] as const;

const liveDataOnly = process.env.NEXT_PUBLIC_LIVE_DATA_ONLY === "true";

function commaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function summarizeInput(value: string, fallback = "Any") {
  const items = commaList(value);
  if (!items.length) return fallback;
  return `${items.slice(0, 3).join(", ")}${items.length > 3 ? ` +${items.length - 3}` : ""}`;
}

function companySizeFromFilters(min: number | null, max: number | null) {
  if (min !== null && max !== null)
    return `${min.toLocaleString()}–${max.toLocaleString()}`;
  if (min !== null) return `${min.toLocaleString()}+`;
  if (max !== null) return `Up to ${max.toLocaleString()}`;
  return "";
}

function parseCompanySize(value: string): [number?, number?] {
  const normalized = value.replaceAll(",", "").trim();
  const range = normalized.match(/^(\d+)\s*(?:-|–|—|to)\s*(\d+)$/i);
  if (range?.[1] && range[2]) return [Number(range[1]), Number(range[2])];
  const minimum = normalized.match(/^(\d+)\s*\+$/);
  if (minimum?.[1]) return [Number(minimum[1])];
  const maximum = normalized.match(/^up to\s+(\d+)$/i);
  if (maximum?.[1]) return [undefined, Number(maximum[1])];
  return [];
}

function formatCompactNumber(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

function revenueSummary(minimum: string, maximum: string) {
  if (minimum && maximum)
    return `${formatCompactNumber(minimum)}–${formatCompactNumber(maximum)}`;
  if (minimum) return `${formatCompactNumber(minimum)}+`;
  if (maximum) return `Up to ${formatCompactNumber(maximum)}`;
  return "Any revenue";
}

function SearchTemplateRow({
  icon,
  label,
  value,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-t border-slate-200 first:border-t-0 dark:border-slate-800">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:px-5 dark:hover:bg-slate-900/70 [&::-webkit-details-marker]:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900 dark:text-white">
            {label}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
            {value}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-5 dark:border-slate-800 dark:bg-slate-950/50">
        {children}
      </div>
    </details>
  );
}

export function SearchComposer({
  initialBrief = "",
}: {
  initialBrief?: string;
}) {
  const router = useRouter();
  const [brief, setBrief] = useState(initialBrief);
  const [structured, setStructured] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [interpretation, setInterpretation] =
    useState<SearchUnderstanding | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  const [interpretationError, setInterpretationError] = useState("");
  const [limitInput, setLimitInput] = useState(liveDataOnly ? "10" : "100");
  const limit = Number(limitInput);
  const limitValid = Number.isInteger(limit) && limit >= 1 && limit <= 1_000;
  const [availableCredits, setAvailableCredits] = useState<number | null>(null);
  const [creditState, setCreditState] = useState<
    "loading" | "live" | "demo" | "error"
  >("loading");
  const idempotencyKeyRef = useRef<string | null>(null);
  const interpretationRequestRef = useRef(0);
  const interpretationTimerRef = useRef<number | null>(null);
  const manuallyEditedFieldsRef = useRef<Set<keyof SearchForm>>(new Set());
  const limitManuallyEditedRef = useRef(false);
  const searchBriefRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    requestOrFallback<{
      data?: { balance?: number; reserved?: number };
      meta?: { demo?: boolean };
    }>("/api/usage", {
      data: { balance: 188, reserved: 0 },
      meta: { demo: true },
    })
      .then(({ data, source }) => {
        if (!active) return;
        if (typeof data.data?.balance === "number") {
          setAvailableCredits(
            Math.max(0, data.data.balance - (data.data.reserved ?? 0)),
          );
          setCreditState(
            source === "demo" || data.meta?.demo ? "demo" : "live",
          );
        } else {
          setAvailableCredits(null);
          setCreditState("error");
        }
      })
      .catch(() => {
        if (active) {
          setAvailableCredits(null);
          setCreditState("error");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (limitManuallyEditedRef.current) return;
    const requestedCount = requestedLeadCountFromBrief(brief);
    if (requestedCount === undefined) return;
    setLimitInput(String(requestedCount));
    idempotencyKeyRef.current = null;
  }, [brief]);

  const invalidateAttempt = () => {
    idempotencyKeyRef.current = null;
  };
  const invalidateInterpretation = () => {
    interpretationRequestRef.current += 1;
    setInterpretation(null);
    setInterpretationError("");
    setInterpreting(false);
  };
  const interpretBrief = useCallback(
    async ({ automatic = false }: { automatic?: boolean } = {}) => {
      const query = brief.trim();
      if (query.length < 3) {
        if (!automatic) {
          setInterpretationError(
            "Add a little more detail so AI can build the template.",
          );
        }
        return;
      }
      const requestId = ++interpretationRequestRef.current;
      setInterpretationError("");
      setInterpreting(true);
      try {
        const response = await fetch("/api/ai/search-understanding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, mode: "B2B" }),
        });
        const payload = (await response.json()) as {
          data?: SearchUnderstanding;
          error?: { message?: string };
        };
        if (!response.ok || !payload.data) {
          throw new Error(
            payload.error?.message ??
              "The search template could not be prepared.",
          );
        }
        if (requestId !== interpretationRequestRef.current) return;
        setInterpretation(payload.data);
        const ai = payload.data.filters;
        const untouched = (field: keyof SearchForm) =>
          !manuallyEditedFieldsRef.current.has(field);
        const parsedSize = companySizeFromFilters(
          ai.employeeMin,
          ai.employeeMax,
        );
        const parsedKeywords = Array.from(
          new Set([...ai.keywords, ...ai.websiteSignals]),
        ).join(", ");
        setForm((current) => ({
          ...current,
          runLabel: untouched("runLabel")
            ? payload.data!.targetDescription.slice(0, 120)
            : current.runLabel,
          industry: untouched("industry")
            ? ai.industries.join(", ")
            : current.industry,
          location: untouched("location")
            ? ai.locations.join(", ")
            : current.location,
          excludedLocation: untouched("excludedLocation")
            ? ai.excludedLocations.join(", ")
            : current.excludedLocation,
          companySize: untouched("companySize")
            ? parsedSize
            : current.companySize,
          jobTitle: untouched("jobTitle")
            ? ai.jobTitles.join(", ")
            : current.jobTitle,
          emailRequirement: untouched("emailRequirement")
            ? ai.emailRequirement
            : current.emailRequirement,
          websiteRequirement: untouched("websiteRequirement")
            ? ai.websiteRequirement
            : current.websiteRequirement,
          technologies: untouched("technologies")
            ? ai.technologies.join(", ")
            : current.technologies,
          keywords: untouched("keywords") ? parsedKeywords : current.keywords,
          revenueMin: untouched("revenueMin")
            ? (ai.revenueMin?.toString() ?? "")
            : current.revenueMin,
          revenueMax: untouched("revenueMax")
            ? (ai.revenueMax?.toString() ?? "")
            : current.revenueMax,
          funding: untouched("funding")
            ? ai.fundingStages.join(", ")
            : current.funding,
          hiring: untouched("hiring") ? ai.isHiring === true : current.hiring,
        }));
      } catch (interpretError) {
        if (requestId !== interpretationRequestRef.current) return;
        setInterpretationError(
          interpretError instanceof Error
            ? interpretError.message
            : "The search template could not be prepared.",
        );
      } finally {
        if (requestId === interpretationRequestRef.current) {
          setInterpreting(false);
        }
      }
    },
    [brief],
  );

  const submitInterpretation = useCallback(() => {
    if (interpretationTimerRef.current !== null) {
      window.clearTimeout(interpretationTimerRef.current);
      interpretationTimerRef.current = null;
    }
    void interpretBrief();
  }, [interpretBrief]);

  useEffect(() => {
    if (brief.trim().length < 3) {
      if (interpretationTimerRef.current !== null) {
        window.clearTimeout(interpretationTimerRef.current);
        interpretationTimerRef.current = null;
      }
      return;
    }
    const timer = window.setTimeout(() => {
      interpretationTimerRef.current = null;
      void interpretBrief({ automatic: true });
    }, 900);
    interpretationTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (interpretationTimerRef.current === timer) {
        interpretationTimerRef.current = null;
      }
    };
  }, [brief, interpretBrief]);

  useLayoutEffect(() => {
    const textarea = searchBriefRef.current;
    if (!textarea) return;
    const maximumHeight = 168;
    textarea.style.height = "0px";
    const contentHeight = Math.max(48, textarea.scrollHeight);
    textarea.style.height = `${Math.min(contentHeight, maximumHeight)}px`;
    textarea.style.overflowY =
      contentHeight > maximumHeight ? "auto" : "hidden";
  }, [brief]);

  const update = <K extends keyof SearchForm>(key: K, value: SearchForm[K]) => {
    invalidateAttempt();
    manuallyEditedFieldsRef.current.add(key);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const updateLimit = (value: string) => {
    invalidateAttempt();
    limitManuallyEditedRef.current = true;
    setLimitInput(value);
  };
  const launch = async () => {
    setError("");
    if (!brief.trim() && !structured) {
      setError(
        "Describe the audience or open structured filters before launching.",
      );
      return;
    }
    if (availableCredits === null) {
      setError(
        "The live credit balance is unavailable. Athreix will not launch or reserve credits until it can confirm the workspace balance.",
      );
      return;
    }
    const countFromBrief = limitManuallyEditedRef.current
      ? undefined
      : requestedLeadCountFromBrief(brief);
    const requestedLimit = countFromBrief ?? limit;
    if (
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1 ||
      requestedLimit > 1_000
    ) {
      setError("Enter a qualified lead count from 1 to 1,000.");
      return;
    }
    if (requestedLimit > availableCredits) {
      setError(
        `This search requests ${requestedLimit} leads, but only ${availableCredits} credits are currently available.`,
      );
      return;
    }
    const currentYear = new Date().getFullYear();
    const foundedAfter = form.foundedAfter
      ? Number(form.foundedAfter)
      : undefined;
    const foundedBefore = form.foundedBefore
      ? Number(form.foundedBefore)
      : undefined;
    const revenueMin = form.revenueMin ? Number(form.revenueMin) : undefined;
    const revenueMax = form.revenueMax ? Number(form.revenueMax) : undefined;
    const invalidFoundedYear = [foundedAfter, foundedBefore].some(
      (value) =>
        value !== undefined &&
        (!Number.isInteger(value) || value < 1800 || value > currentYear),
    );
    if (
      invalidFoundedYear ||
      (foundedAfter !== undefined &&
        foundedBefore !== undefined &&
        foundedAfter > foundedBefore)
    ) {
      setError(
        `Enter valid founded-after and founded-before years from 1800 to ${currentYear}; the after year cannot exceed the before year.`,
      );
      return;
    }
    if (
      [revenueMin, revenueMax].some(
        (value) =>
          value !== undefined && (!Number.isFinite(value) || value < 0),
      ) ||
      (revenueMin !== undefined &&
        revenueMax !== undefined &&
        revenueMin > revenueMax)
    ) {
      setError(
        "Enter a valid revenue range; the minimum cannot exceed the maximum.",
      );
      return;
    }
    setLaunching(true);
    const employeeRange = parseCompanySize(form.companySize);
    const query =
      brief.trim() ||
      `Business prospect search in ${form.location || "the selected region"}`;
    const filters = {
      industries: commaList(form.industry),
      locations: commaList(form.location),
      excludedLocations: commaList(form.excludedLocation),
      employeeMin: employeeRange?.[0],
      employeeMax: employeeRange?.[1],
      revenueMin,
      revenueMax,
      jobTitles: commaList(form.jobTitle),
      keywords: commaList(form.keywords),
      technologies: commaList(form.technologies),
      foundedAfter,
      foundedBefore,
      fundingStages: commaList(form.funding),
      hasEmail: form.emailRequirement === "AVAILABLE" ? true : undefined,
      hasWebsite:
        form.websiteRequirement === "PRESENT"
          ? true
          : form.websiteRequirement === "MISSING"
            ? false
            : undefined,
      isHiring: form.hiring || undefined,
      websiteKeywords: commaList(form.keywords),
      linkedinKeywords: commaList(form.keywords),
      scoreThreshold: Number(form.score),
    };
    const fallback = { id: "demo-processing", meta: { demo: true } };
    const idempotencyKey =
      idempotencyKeyRef.current ?? `search-${crypto.randomUUID()}`;
    idempotencyKeyRef.current = idempotencyKey;
    try {
      const { data, source } = await requestOrFallback<{
        id?: string;
        search?: { id?: string };
        data?: { search?: { id?: string } };
        meta?: { demo?: boolean };
      }>("/api/search", fallback, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          name: form.runLabel.trim() || undefined,
          mode: "B2B",
          query,
          filters,
          targetCount: requestedLimit,
        }),
      });
      const id = data.id ?? data.search?.id ?? data.data?.search?.id;
      if (!id)
        throw new Error("The search was created without a job identifier.");
      idempotencyKeyRef.current = null;
      const isDemo = source === "demo" || data.meta?.demo === true;
      router.push(
        `/search/${id}?processing=1&mode=B2B&brief=${encodeURIComponent(query)}&target=${requestedLimit}${isDemo ? "&demo=1" : ""}`,
      );
    } catch (launchError) {
      if (launchError instanceof ApiRequestError)
        idempotencyKeyRef.current = null;
      setError(
        launchError instanceof ApiRequestError
          ? launchError.message
          : launchError instanceof Error
            ? launchError.message
            : "The search could not be created. Try again.",
      );
      setLaunching(false);
    }
  };
  const expanded = brief.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="min-w-0 space-y-5">
        <Surface
          style={{ borderRadius: 30 }}
          className="scan-beam mx-auto w-full max-w-4xl overflow-hidden border-primary/20 bg-white/88 shadow-[0_26px_85px_oklch(0.17_0.03_272/0.13)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_32px_95px_oklch(0.17_0.03_272/0.17)] motion-reduce:transition-none dark:bg-slate-900/88"
        >
          <div className="relative flex w-full items-start p-2.5 sm:p-3">
            <Search
              aria-hidden="true"
              className="ml-2.5 mt-3.5 size-5 shrink-0 text-primary"
            />
            <label htmlFor="search-brief" className="sr-only">
              Search brief
            </label>
            <textarea
              ref={searchBriefRef}
              id="search-brief"
              rows={1}
              value={brief}
              onChange={(event) => {
                const nextBrief = event.target.value;
                invalidateAttempt();
                invalidateInterpretation();
                if (!nextBrief.trim()) setStructured(false);
                setBrief(nextBrief);
              }}
              onKeyDown={(event) => {
                if (
                  event.key !== "Enter" ||
                  event.shiftKey ||
                  event.nativeEvent.isComposing
                ) {
                  return;
                }
                event.preventDefault();
                submitInterpretation();
              }}
              placeholder="Search companies, people, technologies, or buying signals"
              className="min-h-12 max-h-[10.5rem] w-full resize-none overflow-y-hidden border-0 bg-transparent px-3 py-2.5 text-base font-medium leading-7 text-zinc-950 outline-none placeholder:font-normal placeholder:text-zinc-500 dark:text-white dark:placeholder:text-zinc-400 sm:text-lg"
            />
            <button
              type="button"
              aria-label="Interpret search"
              aria-keyshortcuts="Enter"
              aria-busy={interpreting}
              title="Interpret search (Enter)"
              disabled={brief.trim().length < 3 || interpreting}
              onClick={submitInterpretation}
              className="mr-1 mt-1.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_10px_24px_oklch(0.6_0.24_281/0.24)] outline-none transition-all hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none motion-reduce:transition-none dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            >
              {interpreting ? (
                <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <SendHorizontal className="size-4" />
              )}
            </button>
          </div>
        </Surface>

        {expanded ? (
          <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                invalidateAttempt();
                setStructured((value) => !value);
              }}
              aria-expanded={structured}
              className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg px-2 text-sm font-medium text-zinc-700 outline-none hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-100"
            >
              <SlidersHorizontal className="size-4" />
              Advanced filters
              <ChevronDown
                className={cx(
                  "size-4 transition-transform motion-reduce:transition-none",
                  structured && "rotate-180",
                )}
              />
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={interpreting}
                onClick={() => void interpretBrief()}
              >
                <WandSparkles className="size-3.5 text-blue-600 dark:text-blue-400" />
                {interpreting
                  ? "Interpreting…"
                  : interpretation
                    ? "Refresh interpretation"
                    : "Interpret now"}
              </Button>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                Auto-interprets after you pause
              </span>
            </div>
          </div>
        ) : null}

        {expanded ? (
          <Surface className="overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6 dark:border-slate-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300">
                  <Sparkles className="size-3.5" />
                  Live search template
                </div>
                <h2 className="mt-2 text-base font-semibold text-slate-950 dark:text-white">
                  AI-parsed search inputs
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Every constraint detected in your brief is mapped below.
                  Expand any row to review or edit it before launch.
                </p>
                {interpretationError ? (
                  <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                    {interpretationError}
                  </p>
                ) : null}
              </div>
              {interpreting ? (
                <StatusBadge tone="info">
                  <LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" />
                  Parsing brief
                </StatusBadge>
              ) : interpretation ? (
                <StatusBadge tone="success">
                  <Check className="size-3" />
                  {interpretation.confidence}% understood
                </StatusBadge>
              ) : interpretationError ? (
                <StatusBadge tone="warning">Review needed</StatusBadge>
              ) : (
                <StatusBadge>Waiting for AI</StatusBadge>
              )}
            </div>

            <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900/40">
              <Field
                id="search-run-label"
                label="Run label"
                value={form.runLabel}
                onChange={(event) => update("runLabel", event.target.value)}
                placeholder="AI will name this prospect run"
                maxLength={120}
                hint="Used to identify this run in saved searches and research history."
              />
            </div>

            <div>
              <SearchTemplateRow
                icon={<Briefcase className="size-4" />}
                label="Job title"
                value={summarizeInput(form.jobTitle, "Any decision-maker role")}
              >
                <Field
                  id="template-job-title"
                  label="Decision-maker titles"
                  value={form.jobTitle}
                  onChange={(event) => update("jobTitle", event.target.value)}
                  placeholder="Founder, CEO, VP Sales"
                  hint="Separate multiple titles with commas."
                />
              </SearchTemplateRow>

              <SearchTemplateRow
                icon={<MapPin className="size-4" />}
                label="Location (include)"
                value={summarizeInput(form.location, "Any location")}
              >
                <Field
                  id="template-location"
                  label="Included locations"
                  value={form.location}
                  onChange={(event) => update("location", event.target.value)}
                  placeholder="Mumbai, Pune, India"
                  hint="Separate cities, states, or countries with commas."
                />
              </SearchTemplateRow>

              <SearchTemplateRow
                icon={<CircleMinus className="size-4" />}
                label="Location (exclude)"
                value={summarizeInput(
                  form.excludedLocation,
                  "No excluded locations",
                )}
              >
                <Field
                  id="template-excluded-location"
                  label="Excluded locations"
                  value={form.excludedLocation}
                  onChange={(event) =>
                    update("excludedLocation", event.target.value)
                  }
                  placeholder="Delhi, United States"
                  hint="Prospects matching these locations will be removed."
                />
              </SearchTemplateRow>

              <SearchTemplateRow
                icon={<Mail className="size-4" />}
                label="Email status"
                value={
                  form.emailRequirement === "AVAILABLE"
                    ? "Public business email available"
                    : "Any email status"
                }
              >
                <SelectField
                  id="template-email-requirement"
                  label="Email requirement"
                  value={form.emailRequirement}
                  onChange={(event) =>
                    update(
                      "emailRequirement",
                      event.target.value as SearchForm["emailRequirement"],
                    )
                  }
                  hint="Athreix can require a public business email, but does not claim deliverability without evidence."
                >
                  <option value="ANY">Any email status</option>
                  <option value="AVAILABLE">
                    Public business email available
                  </option>
                </SelectField>
              </SearchTemplateRow>

              <SearchTemplateRow
                icon={<Globe2 className="size-4" />}
                label="Company website"
                value={
                  form.websiteRequirement === "PRESENT"
                    ? "Website required"
                    : form.websiteRequirement === "MISSING"
                      ? "Website must be missing"
                      : "Any website status"
                }
              >
                <SelectField
                  id="template-website-requirement"
                  label="Website requirement"
                  value={form.websiteRequirement}
                  onChange={(event) =>
                    update(
                      "websiteRequirement",
                      event.target.value as SearchForm["websiteRequirement"],
                    )
                  }
                >
                  <option value="ANY">Any website status</option>
                  <option value="PRESENT">Website required</option>
                  <option value="MISSING">Website must be missing</option>
                </SelectField>
              </SearchTemplateRow>

              <SearchTemplateRow
                icon={<UsersRound className="size-4" />}
                label="Company size"
                value={form.companySize || "Any company size"}
              >
                <SelectField
                  id="template-company-size"
                  label="Employee range"
                  value={form.companySize}
                  onChange={(event) =>
                    update("companySize", event.target.value)
                  }
                >
                  <option value="">Any size</option>
                  {form.companySize &&
                  !standardCompanySizes.some(
                    (size) => size === form.companySize,
                  ) ? (
                    <option value={form.companySize}>{form.companySize}</option>
                  ) : null}
                  {standardCompanySizes.map((size) => (
                    <option key={size} value={size}>
                      {size} employees
                    </option>
                  ))}
                </SelectField>
              </SearchTemplateRow>

              <SearchTemplateRow
                icon={<Building2 className="size-4" />}
                label="Industry"
                value={summarizeInput(form.industry, "Any industry")}
              >
                <Field
                  id="template-industry"
                  label="Industries"
                  value={form.industry}
                  onChange={(event) => update("industry", event.target.value)}
                  placeholder="SaaS, Manufacturing, Architecture"
                  hint="Separate multiple industries with commas."
                />
              </SearchTemplateRow>

              <SearchTemplateRow
                icon={<Database className="size-4" />}
                label="Technology"
                value={summarizeInput(
                  form.technologies,
                  "Any technology stack",
                )}
              >
                <Field
                  id="template-technologies"
                  label="Detected or required technologies"
                  value={form.technologies}
                  onChange={(event) =>
                    update("technologies", event.target.value)
                  }
                  placeholder="Salesforce, WordPress, Shopify"
                  hint="Separate multiple required technologies with commas."
                />
              </SearchTemplateRow>

              <SearchTemplateRow
                icon={<Tags className="size-4" />}
                label="Keywords"
                value={summarizeInput(form.keywords, "No keyword constraint")}
              >
                <Field
                  id="template-keywords"
                  label="Company and website keywords"
                  value={form.keywords}
                  onChange={(event) => update("keywords", event.target.value)}
                  placeholder="AI, outdated website, weak branding"
                  hint="Used for company discovery and website evidence matching."
                />
              </SearchTemplateRow>

              <SearchTemplateRow
                icon={<TrendingUp className="size-4" />}
                label="Growth signals"
                value={
                  form.hiring
                    ? summarizeInput(
                        interpretation?.filters.growthSignals.join(", ") ?? "",
                        "Currently hiring",
                      )
                    : summarizeInput(
                        interpretation?.filters.growthSignals.join(", ") ?? "",
                        "No required growth signal",
                      )
                }
              >
                <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.hiring}
                    onChange={(event) => update("hiring", event.target.checked)}
                    className="size-4 accent-blue-600"
                  />
                  <span>Require evidence of current hiring activity</span>
                </label>
              </SearchTemplateRow>

              <SearchTemplateRow
                icon={<Banknote className="size-4" />}
                label="Revenue"
                value={revenueSummary(form.revenueMin, form.revenueMax)}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="template-revenue-minimum"
                    label="Minimum annual revenue"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={form.revenueMin}
                    onChange={(event) =>
                      update("revenueMin", event.target.value)
                    }
                    placeholder="e.g. 10000000"
                  />
                  <Field
                    id="template-revenue-maximum"
                    label="Maximum annual revenue"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={form.revenueMax}
                    onChange={(event) =>
                      update("revenueMax", event.target.value)
                    }
                    placeholder="No maximum"
                  />
                </div>
              </SearchTemplateRow>

              <SearchTemplateRow
                icon={<Landmark className="size-4" />}
                label="Funding"
                value={summarizeInput(form.funding, "Any funding stage")}
              >
                <Field
                  id="template-funding"
                  label="Funding stages"
                  value={form.funding}
                  onChange={(event) => update("funding", event.target.value)}
                  placeholder="Seed, Series A, Bootstrapped"
                  hint="Separate multiple funding stages with commas."
                />
              </SearchTemplateRow>

              <SearchTemplateRow
                icon={<Settings2 className="size-4" />}
                label="Run options"
                value={`${limitValid ? `${limit} qualified leads` : "Set lead count"} · ${interpretation?.researchPlan.length ?? 0} research stages`}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="template-result-limit"
                    label="Qualified leads to deliver"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1_000}
                    value={limitInput}
                    onChange={(event) => updateLimit(event.target.value)}
                    hint="Athreix reviews extra candidates, then stores and charges only up to this exact count."
                  />
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                      Apify research stages
                    </p>
                    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                      {interpretation?.researchPlan.length ? (
                        interpretation.researchPlan.map((stage, index) => (
                          <StatusBadge key={`${stage}-${index}`}>
                            {stage.replaceAll("_", " ")}
                          </StatusBadge>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">
                          Stages appear after AI interpretation.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {interpretation?.assumptions.length ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {interpretation.assumptions.join(" · ")}
                  </p>
                ) : null}
              </SearchTemplateRow>
            </div>
          </Surface>
        ) : null}

        {structured ? (
          <Surface className="p-5 sm:p-7">
            <div className="mb-6">
              <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
                Advanced filters
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Optional age and qualification constraints.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Founded after"
                type="number"
                inputMode="numeric"
                min={1800}
                max={new Date().getFullYear()}
                value={form.foundedAfter}
                onChange={(event) => update("foundedAfter", event.target.value)}
                placeholder="e.g. 2020"
                hint="Only companies founded after this year."
              />
              <Field
                label="Founded before"
                type="number"
                inputMode="numeric"
                min={1800}
                max={new Date().getFullYear()}
                value={form.foundedBefore}
                onChange={(event) =>
                  update("foundedBefore", event.target.value)
                }
                placeholder="e.g. 2024"
                hint="Only companies founded before this year."
              />
              <SelectField
                label="Minimum AI score"
                value={form.score}
                onChange={(event) => update("score", event.target.value)}
              >
                <option value="0">No minimum</option>
                <option value="50">50+</option>
                <option value="65">65+</option>
                <option value="80">80+</option>
              </SelectField>
            </div>
          </Surface>
        ) : null}

        {error ? (
          <InlineNotice
            title="Search cannot start yet"
            tone="danger"
            icon={<CircleAlert className="size-4" />}
          >
            <p>{error}</p>
          </InlineNotice>
        ) : null}

        {expanded ? (
          <div className="flex flex-col gap-4 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <div className="max-w-2xl">
              {!limitValid ? (
                <p className="text-xs leading-5 text-red-700 dark:text-red-300">
                  Enter a qualified lead count from 1 to 1,000.
                </p>
              ) : availableCredits !== null && limit > availableCredits ? (
                <p className="text-xs leading-5 text-amber-900 dark:text-amber-200">
                  Only {availableCredits} results can be returned with your
                  current balance. Adjust the limit or add credits.
                </p>
              ) : liveDataOnly ? (
                <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Results come directly from Apify. Runs can use your Apify
                  balance, and synthetic records are never substituted.
                </p>
              ) : creditState === "demo" ? (
                <p className="text-xs leading-5 text-zinc-500">
                  Using the local preview credit balance; no production credits
                  will be reserved.
                </p>
              ) : creditState === "error" ? (
                <p className="text-xs leading-5 text-red-700 dark:text-red-300">
                  Live balance unavailable. Search launch is disabled.
                </p>
              ) : (
                <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Credits are charged only for successfully stored,
                  non-duplicate records.
                </p>
              )}
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <label htmlFor="quick-result-limit" className="sr-only">
                Lead limit
              </label>
              <input
                id="quick-result-limit"
                type="number"
                inputMode="numeric"
                min={1}
                max={1_000}
                step={1}
                value={limitInput}
                onChange={(event) => updateLimit(event.target.value)}
                disabled={availableCredits === null || launching}
                aria-describedby="quick-result-limit-hint"
                className="min-h-11 w-28 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium tabular-nums text-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              />
              <span id="quick-result-limit-hint" className="sr-only">
                Exact qualified lead count. Enter a number from 1 to 1,000.
              </span>
              <Button
                className="min-w-0 flex-1 sm:flex-none"
                loading={launching}
                onClick={launch}
                disabled={
                  availableCredits === null ||
                  !limitValid ||
                  limit > availableCredits
                }
              >
                {launching ? "Creating job…" : "Generate prospects"}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
