import {
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  ExternalLink,
  Fingerprint,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const evidence: Array<[LucideIcon, string, string]> = [
  [ExternalLink, "Company website", "Checked 2h ago"],
  [ShieldCheck, "Professional profile", "High confidence"],
  [Clock3, "Hiring signal", "Updated today"],
];

export function EvidencePreview() {
  return (
    <div className="surface-light overflow-hidden rounded-[1.75rem] border border-white/12 bg-[oklch(0.985_0.006_88)] text-[oklch(0.17_0.03_272)] shadow-[0_40px_100px_oklch(0.04_0.03_272/0.45)]">
      <div className="flex items-center justify-between border-b px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border bg-white text-xs font-bold shadow-sm">
            RM
          </span>
          <div>
            <p className="text-sm font-bold">Rhea Mehta</p>
            <p className="text-xs text-muted-foreground">Founder · Loopdesk</p>
          </div>
        </div>
        <div className="text-right">
          <span className="flex items-center gap-2">
            <span className="signal-dot" />
            <span className="metric-number text-2xl">94</span>
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            fit score
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-[1.05fr_0.95fr]">
        <div className="p-5 sm:p-7">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Sparkles className="size-4 text-primary" />
            Why this prospect fits
          </div>
          <ul className="mt-6 space-y-4">
            {[
              "Founder role directly matches the requested decision-maker.",
              "34-person SaaS company falls inside the 20–200 employee range.",
              "Three current sales openings indicate near-term growth intent.",
            ].map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[oklch(0.9_0.05_158)]">
                  <Check className="size-3 text-[oklch(0.32_0.12_158)]" />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-7 rounded-2xl border border-primary/15 bg-primary/[0.055] p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              <Fingerprint className="size-3.5" /> Suggested opening
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Reference Loopdesk&apos;s sales hiring momentum and offer a
              focused way to improve outbound coverage without adding research
              overhead.
            </p>
          </div>
        </div>

        <div className="border-t bg-[oklch(0.955_0.012_88)] p-5 md:border-l md:border-t-0 sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Evidence trail
          </p>
          <div className="mt-4">
            {evidence.map(([Icon, label, meta]) => (
              <div
                key={label}
                className="group flex items-center gap-3 border-b py-4 last:border-0"
              >
                <span className="flex size-9 items-center justify-center rounded-xl border bg-white shadow-sm">
                  <Icon className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">{meta}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[oklch(0.17_0.03_272)] px-3 text-xs font-bold text-white"
            >
              <Mail className="size-3.5" /> Draft email
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-white px-3 text-xs font-bold"
            >
              <CircleHelp className="size-3.5" /> Challenge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
