import Link from "next/link";
import { ArrowLeft, Check, ShieldCheck, Sparkles } from "lucide-react";

import { Brand } from "@/components/marketing/brand";

export function AuthShell({
  title,
  description,
  children,
  compact = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <main
      className={`auth-stage min-h-dvh ${compact ? "auth-stage-compact" : ""}`}
    >
      <div aria-hidden="true" className="auth-stage-grid" />
      <div className="auth-layout">
        <aside className="auth-story hidden lg:flex">
          <div aria-hidden="true" className="auth-story-grid" />
          <div className="auth-story-top">
            <Brand />
          </div>

          <div className="auth-story-copy">
            <h2 className="display-serif max-w-[11ch] text-5xl leading-[0.94] text-slate-950 xl:text-7xl dark:text-white">
              Come back to a clearer view of your market.
            </h2>
            <p className="mt-7 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
              Turn one focused brief into qualified companies, verified
              decision-makers, and evidence your team can inspect.
            </p>
          </div>

          <div className="auth-story-footer">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Human-reviewed outreach only. Authorization, source terms, and
              applicable law continue to govern every use.
            </span>
          </div>
        </aside>

        <section className="auth-form-zone">
          <div className="auth-mobile-header lg:hidden">
            <Brand />
            <Link
              href="/"
              className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
              aria-label="Back to home"
            >
              <ArrowLeft className="size-4" />
            </Link>
          </div>

          <div className="auth-back-row hidden lg:flex">
            <Link href="/" className="auth-back-link">
              <ArrowLeft className="size-4" /> Back to site
            </Link>
          </div>

          <div className="auth-form-center">
            <div className="auth-form-card">
              <span aria-hidden="true" className="auth-form-orbit" />
              <span className="auth-form-kicker">
                <Sparkles className="size-3.5" />
                Private workspace
              </span>
              <h1 className="display-serif mt-6 text-4xl leading-none text-slate-950 sm:text-5xl dark:text-white">
                {title}
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
                {description}
              </p>
              <div className="auth-form-body mt-8">{children}</div>
              <div className="auth-security-note">
                <Check className="size-3.5 text-[oklch(0.42_0.11_145)]" />
                Encrypted sessions · rate-limited access
              </div>
            </div>

            <p className="auth-form-caption">
              Your evidence, lists, and search history stay attached to your
              workspace.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
