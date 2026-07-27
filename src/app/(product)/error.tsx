"use client";

import { RotateCcw, ShieldAlert } from "lucide-react";
import { Button, InlineNotice } from "@/components/product/ui";

export default function ProductError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-xl items-center">
      <div className="w-full">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
          Workspace interrupted
        </p>
        <h1 className="display-serif mt-4 text-4xl leading-none text-zinc-950 dark:text-white">
          This view could not be prepared.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Your saved work was not changed. Retry the view; if the problem
          continues, check system health before repeating a mutation.
        </p>
        <div className="mt-6">
          <InlineNotice
            title="No action was assumed complete"
            tone="warning"
            icon={<ShieldAlert className="size-4" />}
          >
            <p>
              Confirm the current job, export, or credit state before trying the
              operation again.
            </p>
          </InlineNotice>
        </div>
        <Button className="mt-6" onClick={reset}>
          <RotateCcw className="size-4" />
          Retry view
        </Button>
      </div>
    </div>
  );
}
