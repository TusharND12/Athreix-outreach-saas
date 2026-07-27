import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/marketing/brand";

export default function NotFound() {
  return (
    <main className="surface-dark signal-orbit relative flex min-h-dvh flex-col overflow-hidden text-white">
      <div aria-hidden="true" className="signal-grid absolute inset-0" />
      <div className="container-shell flex min-h-20 items-center border-b border-white/10">
        <Brand inverse />
      </div>
      <div className="container-shell relative grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1fr_0.65fr]">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-amber-400">
            404 · No matching record
          </p>
          <h1 className="display-serif mt-6 text-6xl leading-[0.9] sm:text-8xl">
            This route is outside the brief.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/65">
            The page may have moved, expired, or never existed. Return to the
            product and continue from a known workspace state.
          </p>
          <Button asChild className="mt-8 rounded-full px-6">
            <Link href="/search">
              <ArrowLeft className="size-4" />
              Return to research
            </Link>
          </Button>
        </div>
        <div className="flex min-h-80 items-center justify-center rounded-[2rem] border border-white/12 bg-white/[0.045] shadow-[0_30px_90px_oklch(0.04_0.03_272/0.4)] backdrop-blur-xl">
          <div className="text-center">
            <span className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-white/12 bg-black/30 text-[oklch(0.82_0.18_158)]">
              <SearchX className="size-6" />
            </span>
            <p className="mt-5 font-mono text-sm text-white/55">
              result: not_found
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
