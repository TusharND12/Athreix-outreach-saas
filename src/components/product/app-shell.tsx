"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Building2,
  ChartNoAxesColumnIncreasing,
  ChevronLeft,
  ChevronRight,
  Command,
  CreditCard,
  Download,
  History,
  ListFilter,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { IconButton, cx } from "./ui";

type NavigationItem = {
  href: string;
  label: string;
  caption: string;
  code: string;
  icon: LucideIcon;
};

const mainNavigation = [
  {
    href: "/search",
    label: "AI research",
    caption: "Discover signal",
    code: "01",
    icon: Sparkles,
  },
  {
    href: "/history",
    label: "History",
    caption: "Return to a run",
    code: "02",
    icon: History,
  },
  {
    href: "/companies",
    label: "Companies",
    caption: "Map intelligence",
    code: "03",
    icon: Building2,
  },
  {
    href: "/lists",
    label: "Saved lists",
    caption: "Curate prospects",
    code: "04",
    icon: ListFilter,
  },
  {
    href: "/exports",
    label: "Exports",
    caption: "Move data out",
    code: "05",
    icon: Download,
  },
] satisfies NavigationItem[];

const accountNavigation = [
  {
    href: "/usage",
    label: "Usage",
    caption: "Credits and limits",
    code: "06",
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    href: "/settings",
    label: "Settings",
    caption: "Tune workspace",
    code: "07",
    icon: Settings,
  },
  {
    href: "/billing",
    label: "Billing",
    caption: "Plan and invoices",
    code: "08",
    icon: CreditCard,
  },
  {
    href: "/profile",
    label: "Profile",
    caption: "Identity",
    code: "09",
    icon: UserRound,
  },
] satisfies NavigationItem[];

const adminNavigation = {
  href: "/admin",
  label: "Admin operations",
  caption: "Customers and systems",
  code: "10",
  icon: ShieldCheck,
} satisfies NavigationItem;

const commandItems = [
  {
    href: "/search",
    label: "Start a new prospect search",
    group: "Actions",
    keywords: "find leads b2b companies",
  },
  {
    href: "/history",
    label: "Open search history",
    group: "Navigate",
    keywords: "past saved searches leads history",
  },
  {
    href: "/lists",
    label: "Open saved lists",
    group: "Navigate",
    keywords: "folders leads prospects",
  },
  {
    href: "/companies",
    label: "Open company intelligence",
    group: "Navigate",
    keywords: "accounts companies reports buying signals",
  },
  {
    href: "/exports",
    label: "Prepare an export",
    group: "Actions",
    keywords: "csv xlsx json download",
  },
  {
    href: "/usage",
    label: "Review credit usage",
    group: "Navigate",
    keywords: "credits limits plan",
  },
  {
    href: "/settings",
    label: "Open workspace settings",
    group: "Navigate",
    keywords: "company notifications privacy",
  },
];

const pageNames: Record<string, string> = {
  search: "AI research",
  history: "History",
  companies: "Company intelligence",
  company: "Company report",
  lists: "Saved lists",
  exports: "Exports",
  usage: "Usage",
  settings: "Settings",
  billing: "Billing",
  profile: "Profile",
  admin: "Admin operations",
};

function AthreixMark() {
  return (
    <span className="flex items-center gap-3.5">
      <span
        aria-hidden="true"
        className="athreix-glyph sidebar-brand-glyph grid size-11 grid-cols-2 gap-[3px] rounded-[0.95rem] p-[0.52rem]"
      >
        <span />
        <span />
        <span />
      </span>
      <span className="leading-none">
        <span className="flex items-start gap-1 text-slate-950 dark:text-white">
          <span className="brand-wordmark block">Athreix</span>
          <span className="mt-0.5 text-[7px] font-black text-violet-600 dark:text-violet-300">
            AI
          </span>
        </span>
        <span className="mt-1.5 block text-[8px] font-black uppercase tracking-[0.19em] text-slate-400 dark:text-white/35">
          Prospect intelligence
        </span>
      </span>
    </span>
  );
}

function NavLink({
  href,
  label,
  caption,
  code,
  icon: Icon,
  onNavigate,
  variant = "sidebar",
}: NavigationItem & {
  onNavigate?: () => void;
  variant?: "sidebar" | "horizontal";
}) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  const horizontal = variant === "horizontal";
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={caption ? `${label}: ${caption}` : label}
      aria-current={active ? "page" : undefined}
      className={cx(
        "sidebar-nav-link group relative items-center text-left outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-violet-500",
        horizontal
          ? "desktop-navigation-card flex min-h-[4.25rem] gap-2 rounded-[1.15rem] px-2.5"
          : "grid min-h-[3.65rem] grid-cols-[1.25rem_2.25rem_minmax(0,1fr)_auto] gap-2.5 rounded-[1.15rem] px-2.5",
        active ? "is-active" : "text-slate-600 dark:text-slate-400",
      )}
    >
      {!horizontal ? (
        <span className="sidebar-nav-code tabular-nums text-[8px] font-black tracking-[0.12em]">
          {code}
        </span>
      ) : null}
      <span className="sidebar-icon-shell flex size-9 items-center justify-center rounded-xl">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className={cx("sidebar-nav-copy min-w-0", horizontal && "flex-1")}>
        <span
          className={cx(
            "sidebar-nav-label block font-bold tracking-[-0.01em]",
            horizontal
              ? "whitespace-nowrap text-[12px]"
              : "truncate text-[13px]",
          )}
        >
          {label}
        </span>
        {caption ? (
          <span
            className={cx(
              "sidebar-nav-caption mt-0.5 block text-[9px] font-semibold tracking-[0.01em]",
              horizontal ? "whitespace-nowrap" : "truncate",
            )}
          >
            {caption}
          </span>
        ) : null}
      </span>
      {active ? (
        <span
          className="sidebar-live-beacon mr-1 size-2 rounded-full"
          aria-label="Current page"
        />
      ) : null}
    </Link>
  );
}

function SidebarContent({
  onNavigate,
  isPlatformAdmin,
}: {
  onNavigate?: () => void;
  isPlatformAdmin: boolean;
}) {
  return (
    <div className="product-sidebar relative flex h-full flex-col overflow-hidden border border-slate-200/85 dark:border-slate-800">
      <div
        aria-hidden="true"
        className="sidebar-ambient-orbit pointer-events-none absolute -right-20 -top-24 size-64 rounded-full"
      />
      <div
        aria-hidden="true"
        className="sidebar-ambient-grain pointer-events-none absolute inset-0"
      />
      <div className="sidebar-brand-zone relative z-10 flex min-h-[6.75rem] items-start justify-between px-5 pb-5 pt-5">
        <Link
          href="/search"
          onClick={onNavigate}
          aria-label="Athreix AI research"
          className="outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <AthreixMark />
        </Link>
        {onNavigate ? (
          <IconButton
            aria-label="Close navigation"
            onClick={onNavigate}
            className="text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-white/55 dark:hover:bg-white/8 dark:hover:text-white"
          >
            <X className="size-4" />
          </IconButton>
        ) : null}
        <span className="absolute bottom-3 left-5 flex items-center gap-2 text-[7px] font-black uppercase tracking-[0.22em] text-slate-400/80 dark:text-white/25">
          <span className="h-px w-6 bg-current" />
          Signal operating system
        </span>
      </div>
      <nav
        aria-label="Primary navigation"
        className="sidebar-scroll relative z-10 flex-1 overflow-y-auto px-3.5 pb-4 pt-3"
      >
        <div className="sidebar-section-label mb-2 flex items-center gap-2 px-2.5">
          <span>Core system</span>
          <span className="h-px flex-1 bg-slate-300/60 dark:bg-white/10" />
          <span className="tabular-nums">05</span>
        </div>
        <div className="space-y-1.5">
          {mainNavigation.map((item) => (
            <NavLink key={item.href} {...item} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="sidebar-section-label mb-2 mt-7 flex items-center gap-2 px-2.5">
          <span>Control deck</span>
          <span className="h-px flex-1 bg-slate-300/60 dark:bg-white/10" />
          <span className="tabular-nums">04</span>
        </div>
        <div className="space-y-1.5">
          {accountNavigation.map((item) => (
            <NavLink key={item.href} {...item} onNavigate={onNavigate} />
          ))}
          {isPlatformAdmin ? (
            <NavLink {...adminNavigation} onNavigate={onNavigate} />
          ) : null}
        </div>
      </nav>
    </div>
  );
}

function DesktopNavigationTabs({
  isPlatformAdmin,
}: {
  isPlatformAdmin: boolean;
}) {
  const items = [
    ...mainNavigation,
    ...accountNavigation,
    ...(isPlatformAdmin ? [adminNavigation] : []),
  ];

  return (
    <nav
      id="desktop-navigation"
      aria-label="Desktop navigation"
      className="desktop-navigation-tabs min-w-0 flex-1 overflow-hidden"
    >
      <ol
        className={cx(
          "grid w-full",
          isPlatformAdmin ? "grid-cols-10" : "grid-cols-9",
        )}
      >
        {items.map((item, index) => (
          <li
            key={item.href}
            className="desktop-navigation-tab"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <NavLink {...item} variant="horizontal" />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function CommandMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      commandItems.filter((item) =>
        `${item.label} ${item.keywords}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  );

  const select = (href: string) => {
    router.push(href);
    onClose();
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-[12vh] z-[60] w-[calc(100vw_-_2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-[1.5rem] border border-white/20 bg-white/96 shadow-[0_34px_100px_oklch(0.08_0.03_272/0.3)] outline-none backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/96">
          <Dialog.Title className="sr-only">
            Search pages and actions
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Type to filter available workspace commands, then choose an action.
          </Dialog.Description>
          <label className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
            <Search aria-hidden="true" className="size-4 text-zinc-500" />
            <span className="sr-only">Search commands</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pages and actions…"
              className="h-14 flex-1 bg-transparent text-sm text-zinc-950 outline-none placeholder:text-zinc-500 dark:text-white dark:placeholder:text-zinc-400"
            />
            <kbd className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:border-zinc-700">
              Esc
            </kbd>
          </label>
          <div className="max-h-80 overflow-y-auto p-2">
            {filtered.length ? (
              filtered.map((item) => (
                <button
                  key={item.href + item.label}
                  onClick={() => select(item.href)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-blue-950/30 dark:focus-visible:ring-blue-400"
                >
                  <span className="flex size-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    <Command className="size-3.5 text-blue-600 dark:text-blue-400" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {item.label}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {item.group}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-10 text-center text-sm text-zinc-500">
                No matching command. Try “export” or “settings”.
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AppShell({
  children,
  isPlatformAdmin = false,
}: {
  children: ReactNode;
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopNavigationOpen, setDesktopNavigationOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const segment = pathname.split("/").filter(Boolean)[0] ?? "search";
  const pageName = pageNames[segment] ?? "Workspace";

  return (
    <div className="app-canvas min-h-dvh text-slate-950 dark:text-white">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[70] -translate-y-20 rounded-lg bg-zinc-950 px-4 py-2 text-sm text-white focus:translate-y-0 dark:bg-white dark:text-zinc-950"
      >
        Skip to content
      </a>
      <aside className="fixed bottom-3 left-3 right-3 z-40 hidden items-end gap-2 lg:flex">
        <div className="desktop-sidebar-launcher relative flex h-[4.25rem] w-72 shrink-0 items-center gap-2 overflow-hidden rounded-[1.35rem] border border-slate-200/90 px-2.5 dark:border-slate-800">
          <button
            type="button"
            aria-controls="desktop-navigation"
            aria-expanded={desktopNavigationOpen}
            aria-label={
              desktopNavigationOpen
                ? "Close navigation panel"
                : "Open navigation panel"
            }
            onClick={() => setDesktopNavigationOpen((open) => !open)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span
              aria-hidden="true"
              className="athreix-glyph desktop-sidebar-launcher-glyph grid size-10 shrink-0 grid-cols-2 gap-[2px] rounded-xl p-[0.48rem]"
            >
              <span />
              <span />
              <span />
            </span>
            <span className="min-w-0 leading-none">
              <span className="block text-[13px] font-bold text-slate-950 dark:text-white">
                Navigation
              </span>
              <span className="mt-1.5 block truncate text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                {pageName}
              </span>
            </span>
          </button>
          <IconButton
            aria-label="Search workspace"
            onClick={() => setCommandOpen(true)}
            className="size-9 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-300"
          >
            <Search className="size-4" />
          </IconButton>
          <IconButton
            aria-label={
              desktopNavigationOpen
                ? "Collapse navigation"
                : "Expand navigation"
            }
            aria-controls="desktop-navigation"
            aria-expanded={desktopNavigationOpen}
            onClick={() => setDesktopNavigationOpen((open) => !open)}
            className="size-9 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300"
          >
            {desktopNavigationOpen ? (
              <ChevronLeft className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </IconButton>
        </div>
        {desktopNavigationOpen ? (
          <DesktopNavigationTabs isPlatformAdmin={isPlatformAdmin} />
        ) : null}
      </aside>
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 lg:hidden" />
          <Dialog.Content className="fixed inset-y-2 left-2 z-[60] w-[min(19rem,calc(100vw_-_1rem))] outline-none lg:hidden">
            <Dialog.Title className="sr-only">
              Workspace navigation
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Navigate between Athreix product areas.
            </Dialog.Description>
            <SidebarContent
              onNavigate={() => setMobileOpen(false)}
              isPlatformAdmin={isPlatformAdmin}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <IconButton
        className="fixed left-3 top-3 z-40 bg-white/85 shadow-md backdrop-blur lg:hidden dark:bg-slate-900/85"
        aria-label="Open navigation"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="size-5" />
      </IconButton>
      <div>
        <main
          id="main-content"
          tabIndex={-1}
          className="page-stage mx-auto w-full max-w-[1500px] px-4 py-7 outline-none sm:px-7 sm:py-9 lg:pb-24 xl:px-10"
        >
          {children}
        </main>
      </div>
      <CommandMenu open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
