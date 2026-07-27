import Link from "next/link";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "athreix-glyph size-8 shrink-0 rounded-[0.7rem] p-[0.38rem]",
        className,
      )}
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </span>
  );
}

export function Brand({
  className,
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex min-h-11 items-center gap-2.5 rounded-xl",
        inverse ? "text-white" : "text-foreground",
        className,
      )}
      aria-label="Athreix Prospect AI home"
    >
      <BrandMark />
      <span className="brand-wordmark">Athreix</span>
      <span
        className={cn(
          "hidden border-l pl-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] sm:inline",
          inverse ? "text-white/54" : "text-muted-foreground",
        )}
      >
        Intelligence
      </span>
    </Link>
  );
}
