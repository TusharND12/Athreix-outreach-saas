"use client";

import { ArrowRight, Check, Play, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const stages = [
  [
    "Describe",
    "Write the audience you need in plain English or open structured filters.",
  ],
  [
    "Verify",
    "Athreix normalizes sources, removes duplicates, and shows freshness and confidence.",
  ],
  [
    "Decide",
    "Review ranked prospects, see why they fit, then draft one-to-one outreach.",
  ],
] as const;

export function DemoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="rounded-full border-slate-200 bg-white/78 px-6 text-slate-800 shadow-sm backdrop-blur-sm hover:bg-accent hover:text-primary dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-100"
        >
          <Play aria-hidden="true" fill="currentColor" />
          Watch demo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-0">
        <div className="marketing-lavender-section rounded-t-[1.5rem] px-6 pb-7 pt-6 sm:px-8">
          <DialogHeader>
            <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles aria-hidden="true" className="size-5" />
            </div>
            <DialogTitle className="text-2xl text-slate-950 dark:text-white">
              From audience brief to a clear next action
            </DialogTitle>
            <DialogDescription className="max-w-xl text-slate-600 dark:text-slate-300">
              A concise tour of the core workflow. No automated bulk
              sending—outreach stays a reviewed draft.
            </DialogDescription>
          </DialogHeader>
        </div>
        <ol className="px-6 sm:px-8">
          {stages.map(([title, description], index) => (
            <li
              key={title}
              className="grid grid-cols-[2rem_1fr] gap-4 border-b py-5 last:border-0"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold tabular">
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mx-6 flex items-start gap-3 rounded-2xl border border-[oklch(0.78_0.08_145)] bg-[oklch(0.955_0.035_145)] p-4 text-sm text-[oklch(0.34_0.105_145)] sm:mx-8">
          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="leading-5">
            Every score includes rationale, confidence, source provenance, and
            freshness so you can challenge the result.
          </p>
        </div>
        <DialogFooter className="p-6 pt-2 sm:px-8 sm:pb-8">
          <Button asChild>
            <Link href="/signup">
              Try the workflow <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
