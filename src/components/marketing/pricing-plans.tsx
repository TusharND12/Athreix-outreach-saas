import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    price: "$29",
    credits: "250",
    description: "A focused runway for founders and individual operators.",
    features: [
      "Live B2B prospect research",
      "Complete lead records",
      "Qualification and evidence",
      "CSV, Excel, and JSON export",
    ],
    featured: false,
  },
  {
    name: "Growth",
    price: "$59",
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
    price: "$99",
    credits: "1,000",
    description: "More room for high-intent markets and operational review.",
    features: [
      "All product workflows",
      "1,000 monthly research credits",
      "More operating capacity",
      "The same governance controls",
    ],
    featured: false,
  },
] as const;

export function PricingPlans() {
  return (
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
            starts with 250 one-time preview credits. Base subscription prices
            are shown in USD; Paddle shows the final localized total and any
            applicable taxes before payment.
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
              <div className="mt-10 flex items-end gap-2">
                <span className="metric-number text-6xl">{plan.price}</span>
                <span className="pb-2 text-xs text-muted-foreground">
                  USD / month
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold">
                {plan.credits} monthly credits
              </p>
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
  );
}
