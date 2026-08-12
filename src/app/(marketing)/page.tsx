import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Check,
  CircleDot,
  MessageSquareText,
  Radar,
  Search,
  ShieldCheck,
} from "lucide-react";

import { AnimatedSearchPreview } from "@/components/marketing/animated-search-preview";
import { EvidencePreview } from "@/components/marketing/evidence-preview";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Prospect intelligence with proof",
  description:
    "Find real B2B prospects, understand why they fit, and export complete, evidence-backed lead records.",
};

const capabilities = [
  {
    icon: Search,
    index: "01",
    title: "Brief in plain English",
    copy: "Say who you need, where they operate, what role matters, and how many qualified leads you want. Athreix translates it into a reviewable search.",
    signal: "Language → precise filters",
  },
  {
    icon: Radar,
    index: "02",
    title: "Live-source research",
    copy: "Real Apify collection feeds the workflow. Extra candidates are reviewed, deduplicated, and filtered before the requested number is delivered.",
    signal: "Wide collection · clean pool",
  },
  {
    icon: BadgeCheck,
    index: "03",
    title: "Qualification with receipts",
    copy: "Fit scores include reasons, confidence, freshness, and source context so you can challenge the result before acting.",
    signal: "Evidence on every score",
  },
  {
    icon: MessageSquareText,
    index: "04",
    title: "A clean next action",
    copy: "Open the complete lead record, save a list, export the fields you need, or prepare a one-to-one outreach draft for human review.",
    signal: "Review · save · export",
  },
];

const steps = [
  {
    label: "Describe",
    title: "Write the audience as you understand it.",
    copy: "“Find 25 founders at cybersecurity companies in India with a business email.”",
  },
  {
    label: "Collect",
    title: "Athreix searches beyond the requested count.",
    copy: "The system gathers a wider real-data candidate pool so weak and duplicate records can be removed.",
  },
  {
    label: "Qualify",
    title: "Every candidate earns its place.",
    copy: "Role, geography, company fit, data completeness, and your score threshold determine the final ranking.",
  },
  {
    label: "Decide",
    title: "You receive a full, usable record—not a mystery score.",
    copy: "Review all available fields, inspect the evidence, then save or export only what is appropriate.",
  },
] as const;

const plans = [
  {
    name: "Starter",
    credits: "250",
    description: "A focused runway for founders and individual operators.",
    features: [
      "Live B2B prospect research",
      "Complete lead records",
      "Qualification and evidence",
      "CSV, Excel, and JSON export",
    ],
  },
  {
    name: "Growth",
    credits: "500",
    description: "More capacity for a repeatable weekly research motion.",
    features: [
      "All product workflows",
      "500 monthly research credits",
      "Lists, history, and exports",
      "The same governance controls",
    ],
    featured: true,
  },
  {
    name: "Scale",
    credits: "1,000",
    description: "More room for high-intent markets and operational review.",
    features: [
      "All product workflows",
      "1,000 monthly research credits",
      "More operating capacity",
      "The same governance controls",
    ],
  },
];

const faqs = [
  {
    question: "Is the lead data real?",
    answer:
      "Yes. Live B2B searches use the configured Apify provider. Athreix does not create fictional contacts to fill a requested count.",
  },
  {
    question: "What happens if I request 10 leads?",
    answer:
      "Athreix collects a larger candidate pool, removes duplicates and ineligible records, scores the remainder, and displays no more than the best 10 qualified leads. If the live source cannot provide 10 valid matches, the result states the honest shortfall.",
  },
  {
    question: "Will I see the complete email address?",
    answer:
      "The authorized workspace owner can view available business emails in full. Missing values are shown clearly as null, while restricted records remain visibly protected.",
  },
  {
    question: "Can I export every lead field?",
    answer:
      "Yes. Authorized results can be exported in CSV, Excel, or JSON, including the complete supported lead schema and explicit null values for missing data.",
  },
  {
    question: "Does Athreix send automated outreach?",
    answer:
      "No. It prepares personalized drafts for review. You remain responsible for lawful use, source terms, suppression requirements, and the final send.",
  },
];

export default function LandingPage() {
  return (
    <main className="marketing-landing overflow-clip">
      <section className="marketing-search-hero relative overflow-hidden border-b">
        <div
          aria-hidden="true"
          className="marketing-search-grid absolute inset-0"
        />
        <div className="marketing-hero-content container-shell relative">
          <div className="mx-auto max-w-7xl text-center">
            <h1 className="marketing-display marketing-hero-title mx-auto text-slate-950 dark:text-white">
              Know exactly who to reach{" "}
              <em className="font-normal text-primary">and why.</em>
            </h1>
            <p className="marketing-hero-copy mx-auto max-w-3xl text-base leading-7 text-slate-600 sm:text-lg dark:text-slate-300">
              Describe the market in your own words. Athreix searches wider,
              qualifies every candidate, and delivers only the strongest real
              records.
            </p>

            <AnimatedSearchPreview />
          </div>
        </div>
      </section>

      <section id="product" className="marketing-section">
        <div className="container-shell">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <p className="eyebrow text-primary">The intelligence room</p>
              <h2 className="display-serif mt-6 max-w-[10ch] text-5xl leading-[0.98] sm:text-6xl">
                Not another list of names.
              </h2>
            </div>
            <div className="max-w-2xl lg:pt-10">
              <p className="text-xl leading-8 text-muted-foreground">
                A calm, visible workflow for the difficult part of prospecting:
                deciding who actually deserves attention.
              </p>
            </div>
          </div>

          <div className="marketing-capability-grid mt-14 grid gap-3 lg:grid-cols-12">
            {capabilities.map((item, index) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className={`marketing-capability-card group relative min-h-72 overflow-hidden rounded-[1.75rem] border bg-card p-7 sm:p-9 ${
                    index === 0 || index === 3
                      ? "lg:col-span-7"
                      : "lg:col-span-5"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="marketing-capability-halo"
                  />
                  <div className="flex items-center justify-between">
                    <span className="marketing-capability-icon flex size-11 items-center justify-center rounded-2xl border bg-background text-primary shadow-sm">
                      <Icon className="size-5" />
                    </span>
                    <span className="marketing-capability-index font-mono text-xs">
                      {item.index}
                    </span>
                  </div>
                  <h3 className="display-serif mt-12 text-3xl">{item.title}</h3>
                  <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
                    {item.copy}
                  </p>
                  <span className="marketing-capability-signal mt-8">
                    <span className="signal-dot" />
                    {item.signal}
                  </span>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="marketing-lavender-section marketing-section border-y">
        <div className="container-shell grid items-center gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="eyebrow text-primary">Explainable by design</p>
            <h2 className="display-serif mt-6 max-w-[10ch] text-5xl leading-none text-slate-950 sm:text-6xl dark:text-white">
              A score is the start of the story.
            </h2>
            <p className="mt-7 max-w-lg text-base leading-7 text-slate-600 dark:text-slate-300">
              Inspect the signal, check its freshness, follow the source, and
              challenge the rationale. Confidence comes from evidence—not a
              decorative number.
            </p>
            <div className="mt-9 space-y-3">
              {[
                "Human-readable fit reasons",
                "Source and freshness context",
                "Clear null and restricted states",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200"
                >
                  <Check className="size-4 text-primary" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="marketing-evidence-stage">
            <span
              aria-hidden="true"
              className="marketing-evidence-paper marketing-evidence-paper-a"
            />
            <span
              aria-hidden="true"
              className="marketing-evidence-paper marketing-evidence-paper-b"
            />
            <div className="relative">
              <EvidencePreview />
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="marketing-section">
        <div className="container-shell">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="eyebrow text-primary">One visible flow</p>
              <h2 className="display-serif mt-6 max-w-[9ch] text-5xl leading-none sm:text-6xl">
                Search wide. Deliver sharp.
              </h2>
              <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
                The requested number is the final goal, not the raw collection
                limit.
              </p>
            </div>
            <ol className="border-t">
              {steps.map((step, index) => (
                <li
                  key={step.label}
                  className="grid gap-4 border-b py-8 sm:grid-cols-[4rem_8rem_1fr] sm:gap-6 sm:py-10"
                >
                  <span className="metric-number text-3xl text-primary">
                    0{index + 1}
                  </span>
                  <span className="pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {step.label}
                  </span>
                  <div>
                    <h3 className="display-serif text-2xl">{step.title}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                      {step.copy}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section
        id="modes"
        className="marketing-mint-section border-y py-20 sm:py-28"
      >
        <div className="container-shell grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="eyebrow text-primary">Trust is a product feature</p>
            <h2 className="display-serif mt-6 max-w-[13ch] text-5xl leading-none sm:text-6xl">
              Real data, visible limits, responsible action.
            </h2>
          </div>
          <div className="rounded-[1.5rem] border bg-card/78 p-6 shadow-sm backdrop-blur sm:p-8">
            <ShieldCheck className="size-7 text-primary" />
            <p className="mt-6 text-lg font-semibold">
              Professional research—not a mass-messaging machine.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Athreix keeps authorization, source terms, retention, suppression,
              and human review visible. Public availability does not erase your
              responsibility for lawful use.
            </p>
            <Link
              href="/responsible-use"
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"
            >
              Read the responsible-use policy <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section id="pricing" className="marketing-section">
        <div className="container-shell">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-primary">Simple capacity</p>
              <h2 className="display-serif mt-6 max-w-[12ch] text-5xl leading-none sm:text-6xl">
                Start with the volume you can use well.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              One delivered prospect uses one credit. Every verified workspace
              starts with 250 one-time preview credits; recurring plan prices
              and taxes are shown in secure checkout.
            </p>
          </div>

          <div className="mt-14 grid overflow-hidden rounded-[1.75rem] border bg-card lg:grid-cols-3">
            {plans.map((plan, index) => (
              <article
                key={plan.name}
                className={`relative p-7 sm:p-9 ${
                  index > 0 ? "border-t lg:border-l lg:border-t-0" : ""
                } ${plan.featured ? "bg-[oklch(0.935_0.035_284)]" : "bg-card"}`}
              >
                {plan.featured ? (
                  <span className="absolute right-6 top-6 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                    Most flexible
                  </span>
                ) : null}
                <p className="text-sm font-bold">{plan.name}</p>
                <div className="mt-12 flex items-end gap-2">
                  <span className="metric-number text-6xl">{plan.credits}</span>
                  <span className="pb-2 text-xs text-muted-foreground">
                    credits
                  </span>
                </div>
                <p className="mt-5 min-h-14 text-sm leading-6 text-muted-foreground">
                  {plan.description}
                </p>
                <ul className="mt-7 space-y-3 border-t pt-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={plan.featured ? "default" : "outline"}
                  className="mt-8 w-full rounded-full"
                >
                  <Link href="/signup">Create workspace</Link>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-card py-20 sm:py-28">
        <div className="container-shell grid gap-10 lg:grid-cols-[0.62fr_1.38fr] lg:gap-20">
          <div>
            <p className="eyebrow text-primary">Plain answers</p>
            <h2 className="display-serif mt-6 text-5xl leading-none">
              Before you search.
            </h2>
          </div>
          <Accordion type="single" collapsible className="border-t">
            {faqs.map((faq, index) => (
              <AccordionItem key={faq.question} value={`faq-${index}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="marketing-final-cta relative overflow-hidden border-t py-28 sm:py-36">
        <div
          aria-hidden="true"
          className="marketing-search-grid absolute inset-0"
        />
        <div className="container-shell relative text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border bg-card text-primary shadow-sm">
            <Blocks className="size-6" />
          </span>
          <p className="eyebrow mt-8 justify-center text-primary">
            Your next market is waiting
          </p>
          <h2 className="display-serif mx-auto mt-7 max-w-[13ch] text-5xl leading-[0.94] text-slate-950 sm:text-7xl dark:text-white">
            Begin with a better question.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
            Describe the audience. Inspect the proof. Choose the next action
            from one focused workspace.
          </p>
          <Button asChild size="lg" className="mt-9 rounded-full px-7">
            <Link href="/signup">
              Start searching <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <CircleDot className="size-3" /> Live B2B data · no mock leads
          </div>
        </div>
      </section>
    </main>
  );
}
