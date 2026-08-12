import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export interface LegalSection {
  title: string;
  body: React.ReactNode;
}

export function LegalPage({
  title,
  summary,
  sections,
  effectiveDate = "11 August 2026",
}: {
  title: string;
  summary: string;
  sections: LegalSection[];
  effectiveDate?: string;
}) {
  return (
    <main className="bg-background">
      <header className="surface-dark signal-orbit relative overflow-hidden border-b hairline-dark">
        <div aria-hidden="true" className="signal-grid absolute inset-0" />
        <div className="container-shell relative py-16 sm:py-28">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-white/62 transition-colors hover:text-white"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> Back to Athreix
          </Link>
          <h1 className="display-serif mt-10 max-w-4xl text-5xl leading-none text-white sm:text-7xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/64">
            {summary}
          </p>
          <p className="mt-7 font-mono text-xs text-white/50">
            Effective {effectiveDate}
          </p>
        </div>
      </header>

      <div className="container-shell grid gap-12 py-12 sm:py-16 lg:grid-cols-[15rem_1fr] lg:gap-20 lg:py-20">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <nav className="hidden lg:block" aria-label={`${title} contents`}>
            <p className="text-xs font-semibold text-muted-foreground">
              On this page
            </p>
            <ol className="mt-3 space-y-1">
              {sections.map((section, index) => (
                <li key={section.title}>
                  <a
                    href={`#section-${index + 1}`}
                    className="inline-flex min-h-9 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="max-w-3xl">
          {sections.map((section, index) => (
            <section
              key={section.title}
              id={`section-${index + 1}`}
              className="scroll-mt-28 border-b py-8 first:pt-0 last:border-0"
            >
              <h2 className="display-serif text-3xl">{section.title}</h2>
              <div className="mt-4 space-y-4 text-[0.9375rem] leading-7 text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
                {section.body}
              </div>
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
