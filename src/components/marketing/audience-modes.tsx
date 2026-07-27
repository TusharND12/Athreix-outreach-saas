"use client";

import { Building2, Check, ShieldCheck, UserRound } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const modeContent = {
  b2b: {
    title: "Find companies and the people responsible for the decision.",
    copy: "Use firmographic, role, technology, hiring, and funding signals to identify organizations and relevant professional contacts.",
    example: "CEOs of Pune AI startups founded after 2020",
    icon: Building2,
    checks: [
      "Company and role fit",
      "Professional contact confidence",
      "Technology and intent signals",
    ],
  },
  b2c: {
    title: "Build a purpose-appropriate audience with stricter guardrails.",
    copy: "B2C research is for legitimate business purposes using sources and attributes you are authorized to process. Athreix makes consent, retention, suppression, and export controls explicit.",
    example: "Opted-in customers eligible for a local service renewal",
    icon: UserRound,
    checks: [
      "Lawful-purpose confirmation",
      "No sensitive or minor targeting",
      "Suppression and retention controls",
    ],
  },
} as const;

export function AudienceModes() {
  return (
    <Tabs defaultValue="b2b" className="w-full">
      <TabsList
        className="grid w-full grid-cols-2 sm:w-[22rem]"
        aria-label="Prospecting mode"
      >
        <TabsTrigger value="b2b">B2B research</TabsTrigger>
        <TabsTrigger value="b2c">B2C audiences</TabsTrigger>
      </TabsList>
      {(
        Object.entries(modeContent) as Array<
          [
            keyof typeof modeContent,
            (typeof modeContent)[keyof typeof modeContent],
          ]
        >
      ).map(([key, mode]) => {
        const Icon = mode.icon;
        return (
          <TabsContent key={key} value={key} className="mt-6">
            <div className="overflow-hidden rounded-xl border bg-background">
              <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
                <div className="p-6 sm:p-9 lg:p-12">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="mt-7 max-w-xl text-2xl font-semibold leading-tight tracking-[-0.025em] sm:text-3xl">
                    {mode.title}
                  </h3>
                  <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                    {mode.copy}
                  </p>
                  <ul className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    {mode.checks.map((check) => (
                      <li
                        key={check}
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        <Check
                          aria-hidden="true"
                          className="size-4 text-[oklch(0.42_0.11_145)]"
                        />
                        {check}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="surface-dark flex min-h-[22rem] flex-col justify-between border-t p-6 lg:border-l lg:border-t-0 lg:p-9">
                  <div className="flex items-center justify-between text-xs text-white/52">
                    <span>Example brief</span>
                    <ShieldCheck
                      aria-label="Usage guardrails enabled"
                      className="size-4"
                    />
                  </div>
                  <blockquote className="my-12 text-2xl font-medium leading-snug tracking-[-0.025em] text-white sm:text-3xl">
                    “{mode.example}”
                  </blockquote>
                  <div className="border-t border-white/12 pt-4 text-xs leading-5 text-white/50">
                    Athreix checks scope before processing. A source being
                    accessible does not by itself establish lawful use.
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
