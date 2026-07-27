import Link from "next/link";

import { Brand } from "@/components/marketing/brand";

const footerGroups = [
  {
    label: "Product",
    links: [
      ["Product", "/#product"],
      ["How it works", "/#workflow"],
      ["Plans", "/#pricing"],
      ["Log in", "/login"],
    ],
  },
  {
    label: "Trust",
    links: [
      ["Responsible use", "/responsible-use"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="marketing-footer overflow-hidden border-t">
      <div className="container-shell grid gap-12 py-16 md:grid-cols-[1.45fr_1fr] md:py-24">
        <div>
          <Brand />
          <p className="display-serif mt-7 max-w-lg text-3xl leading-tight text-slate-950 dark:text-white">
            Better signals. Clearer decisions. Human judgment intact.
          </p>
          <p className="mt-7 max-w-md text-xs leading-5 text-muted-foreground">
            Athreix drafts personalized outreach; it does not automate
            unsolicited mass messaging. You remain responsible for lawful use,
            source terms, consent, and suppression obligations.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8">
          {footerGroups.map((group) => (
            <div key={group.label}>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {group.label}
              </h2>
              <ul className="mt-4 space-y-1">
                {group.links.map(([label, href]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="inline-flex min-h-10 items-center text-sm font-medium text-slate-600 transition-all hover:translate-x-0.5 hover:text-primary dark:text-slate-300"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t">
        <div className="container-shell flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Athreix. All rights reserved.</p>
          <p className="inline-flex items-center gap-2">
            <span className="signal-dot" /> Built for focused, responsible
            growth.
          </p>
        </div>
      </div>
    </footer>
  );
}
