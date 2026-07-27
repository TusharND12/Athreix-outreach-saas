import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Check,
  CircleDot,
  Database,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const prospects = [
  {
    initials: "RM",
    name: "Rhea M.",
    title: "Founder",
    company: "Loopdesk",
    location: "Mumbai",
    score: 94,
  },
  {
    initials: "AK",
    name: "Arjun K.",
    title: "VP, Growth",
    company: "Northstar",
    location: "Pune",
    score: 89,
  },
  {
    initials: "SN",
    name: "Sara N.",
    title: "Co-founder",
    company: "Metricly",
    location: "Mumbai",
    score: 87,
  },
];

const pipelineSteps: Array<{
  icon: LucideIcon;
  label: string;
  status: "complete" | "live";
}> = [
  {
    icon: Database,
    label: "30 candidates collected",
    status: "complete",
  },
  {
    icon: BadgeCheck,
    label: "Duplicates + weak matches removed",
    status: "complete",
  },
  {
    icon: Sparkles,
    label: "Best 10 ranked and ready",
    status: "live",
  },
];

export function ProspectArtifact() {
  return (
    <div className="scan-beam relative overflow-hidden rounded-[2rem] border border-white/13 bg-[oklch(0.16_0.04_272/0.82)] shadow-[0_45px_120px_oklch(0.05_0.03_272/0.5)] backdrop-blur-xl">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-white/9 px-5 text-[11px] text-white/48 sm:px-7">
        <div className="flex items-center gap-3">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-[oklch(0.7_0.19_35)]" />
            <span className="size-2 rounded-full bg-[oklch(0.82_0.18_158)]" />
            <span className="size-2 rounded-full bg-primary" />
          </span>
          <span className="font-mono uppercase tracking-[0.12em]">
            Athreix / Research room
          </span>
        </div>
        <div className="flex items-center gap-2 text-[oklch(0.82_0.18_158)]">
          <CircleDot className="size-3.5" />
          Live source connected
        </div>
      </div>

      <div className="grid lg:grid-cols-[0.74fr_1.26fr]">
        <div className="border-b border-white/9 p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-white/42">Research brief</span>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold text-white/60">
              B2B
            </span>
          </div>

          <div className="mt-7 rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="flex gap-3">
              <Search className="mt-1 size-4 shrink-0 text-white/40" />
              <p className="text-base font-medium leading-7 text-white/88">
                Find 10 SaaS founders in India with a public business email and
                active sales hiring.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {["Founder", "India", "Business email", "Hiring"].map((filter) => (
              <span key={filter} className="signal-pill">
                {filter}
              </span>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            {pipelineSteps.map(({ icon: ItemIcon, label, status }) => {
              return (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-3"
                >
                  <ItemIcon className="size-4 text-white/45" />
                  <span className="flex-1 text-xs text-white/68">{label}</span>
                  <span
                    className={
                      status === "live"
                        ? "signal-dot"
                        : "text-[oklch(0.82_0.18_158)]"
                    }
                  >
                    {status === "complete" ? (
                      <Check className="size-3.5" />
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-white/9 pt-5">
            <span className="text-[11px] text-white/40">
              Qualified lead goal
            </span>
            <span className="metric-number text-3xl text-white">10</span>
          </div>
        </div>

        <div className="surface-light bg-[oklch(0.985_0.006_88)] text-[oklch(0.17_0.03_272)]">
          <div className="flex flex-col gap-3 border-b border-[oklch(0.87_0.018_88)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold">
                10 qualified leads
                <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.92_0.035_158)] px-2 py-1 text-[10px] text-[oklch(0.32_0.1_158)]">
                  <Check className="size-3" /> exact goal
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Ranked by fit · evidence attached · 36 fields available
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-2 self-start rounded-full border bg-white px-3 text-xs font-bold shadow-sm sm:self-auto"
            >
              Export ready <ArrowUpRight className="size-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[38rem]">
              <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.5fr] border-b bg-[oklch(0.955_0.012_88)] px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <span>Decision maker</span>
                <span>Company</span>
                <span>Location</span>
                <span className="text-right">Fit</span>
              </div>
              {prospects.map((prospect, index) => (
                <div
                  key={prospect.name}
                  className="grid grid-cols-[1.4fr_1fr_0.8fr_0.5fr] items-center border-b px-6 py-4 last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-white text-[10px] font-bold shadow-sm">
                      {prospect.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {prospect.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {prospect.title}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="size-3.5 text-muted-foreground" />
                    {prospect.company}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {prospect.location}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span className="signal-dot" />
                    <span className="metric-number text-lg">
                      {prospect.score}
                    </span>
                  </div>
                  {index === 0 ? (
                    <div className="col-span-4 mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-primary/15 bg-primary/[0.055] px-3 py-2.5 text-[11px] text-primary">
                      <span className="inline-flex items-center gap-1.5 font-bold">
                        <Sparkles className="size-3.5" /> Why this lead
                      </span>
                      <span>Founder match</span>
                      <span>34 employees</span>
                      <span>3 open sales roles</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t bg-[oklch(0.955_0.012_88)] px-6 py-4 text-xs">
            <span className="text-muted-foreground">
              7 more qualified records
            </span>
            <span className="inline-flex items-center gap-1.5 font-bold">
              Open full table <ArrowUpRight className="size-3.5" />
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-white/9 px-5 py-3 text-[10px] uppercase tracking-[0.1em] text-white/32 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <span>Source state, qualification, and credit use remain visible</span>
        <span>Interface preview · illustrative data</span>
      </div>
    </div>
  );
}
