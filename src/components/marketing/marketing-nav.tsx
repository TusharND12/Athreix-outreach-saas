"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import * as React from "react";

import { Brand } from "@/components/marketing/brand";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/#workflow", label: "How it works" },
  { href: "/#pricing", label: "Plans" },
  { href: "/#modes", label: "Trust" },
];

export function MarketingNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="marketing-nav-shell sticky top-0 z-(--z-sticky) border-b">
      <nav
        className="container-shell flex h-[4.5rem] items-center justify-between"
        aria-label="Primary navigation"
      >
        <Brand />
        <div className="hidden items-center gap-0.5 rounded-full border bg-card/72 p-1 shadow-sm lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-9 items-center rounded-full px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-accent hover:text-primary dark:text-slate-300"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <Button
            asChild
            variant="ghost"
            className="text-slate-700 hover:bg-accent hover:text-primary dark:text-slate-200"
          >
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild className="rounded-full px-5">
            <Link href="/signup">Enter workspace</Link>
          </Button>
        </div>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-accent hover:text-primary lg:hidden dark:text-slate-200"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
        </button>
      </nav>
      {open ? (
        <div
          id="mobile-navigation"
          className="border-t bg-card/94 backdrop-blur-xl lg:hidden"
        >
          <div className="container-shell flex flex-col py-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-12 items-center border-b text-sm font-semibold text-slate-700 last:border-0 dark:text-slate-200"
              >
                {link.label}
              </Link>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-4">
              <Button asChild variant="outline" className="bg-transparent">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Get started</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
