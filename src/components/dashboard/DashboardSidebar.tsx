"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type SidebarItem = { href: string; label: string };

/** Line icons keyed by the tab's last path segment. */
const ICONS: Record<string, ReactNode> = {
  overview: <path d="M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z" />,
  webinars: <path d="M2.5 3.5h15v10h-15zM7 17h6M10 13.5V17M8.5 6.5v4l3.5-2-3.5-2z" />,
  scorecard: <path d="M10 17a7 7 0 100-14 7 7 0 000 14zm0-3.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm0-2.5a1 1 0 100-2 1 1 0 000 2z" />,
  "cash-calendar": <path d="M3.5 5h13v11.5h-13zM3.5 8.5h13M7 3v3.5M13 3v3.5" />,
  "sales-team": <path d="M7.5 9a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5zM2.5 16.5c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5M13.5 9a2.25 2.25 0 100-4.5M14.5 12.2c1.8.4 3 1.8 3 4.3" />,
  "knowledge-base": <path d="M4 3.5h9.5a2 2 0 012 2V16.5H6a2 2 0 01-2-2v-11zM4 14.5a2 2 0 012-2h9.5M7.5 7h5M7.5 9.5h3.5" />,
  "live-calls": <path d="M5.5 3h2.2l1.2 3.2-1.6 1.1a8 8 0 004.4 4.4l1.1-1.6 3.2 1.2v2.2a1.5 1.5 0 01-1.6 1.5C8.4 14.6 5.4 11.6 4 5.1A1.5 1.5 0 015.5 3z" />,
  "payment-plans": <path d="M2.5 5h15v10h-15zM2.5 8.5h15M5.5 12.5h3" />,
  "upsell-potential": <path d="M3 14.5l4.5-4.5 3 3L17 6.5M12.5 6.5H17V11" />,
  models: <path d="M10 2.5l7 4-7 4-7-4 7-4zM3 10l7 4 7-4M3 13.5l7 4 7-4" />,
  "ads-analysis": <path d="M3.5 16.5V9M8.5 16.5V4M13.5 16.5v-5M17 16.5H2.5" />,
  "admin-team": <path d="M10 2.5l6 2.5v4.5c0 4-2.6 6.8-6 8-3.4-1.2-6-4-6-8V5l6-2.5z" />,
  commissions: <path d="M10 2.5v15M13.5 5.5H8.25a2.25 2.25 0 000 4.5h3.5a2.25 2.25 0 010 4.5H6" />,
};

function NavIcon({ href }: { href: string }) {
  const key = href.split("/").pop() ?? "";
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {ICONS[key] ?? <circle cx="10" cy="10" r="3" />}
    </svg>
  );
}

function Brand({ initials, name }: { initials: string; name: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-300 to-indigo-500 text-sm font-bold text-[#06122b] shadow-[0_6px_20px_-6px_rgba(99,102,241,0.8)]">
        {initials}
      </div>
      <div>
        <div className="text-[15px] font-semibold text-white">{name}</div>
        <div className="text-xs text-[var(--text-muted)]">Dashboard</div>
      </div>
    </div>
  );
}

function NavLinks({ items, onNavigate }: { items: SidebarItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-gradient-to-r from-sky-400/20 to-indigo-400/10 text-white ring-1 ring-inset ring-sky-300/25"
                : "text-[var(--text-muted)] hover:bg-white/5 hover:text-white"
            }`}
          >
            {active ? (
              <span aria-hidden="true" className="absolute -left-4 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sky-300" />
            ) : null}
            <span className={active ? "text-sky-300" : ""}>
              <NavIcon href={item.href} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

const SIDEBAR_BG = "bg-[#070d20]/80 backdrop-blur-xl";

export function DashboardSidebar({
  initials,
  name,
  items,
}: {
  initials: string;
  name: string;
  items: SidebarItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={`sticky top-0 z-40 flex items-center justify-between border-b border-[var(--panel-border)] p-4 lg:hidden ${SIDEBAR_BG}`}>
        <Brand initials={initials} name={name} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--panel-border)] text-[var(--text-muted)] hover:bg-white/5"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col gap-8 overflow-y-auto border-r border-[var(--panel-border)] bg-[#070d20] p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <Brand initials={initials} name={name} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--panel-border)] text-[var(--text-muted)] hover:bg-white/5"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <NavLinks items={items} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <aside className={`sticky top-0 hidden h-screen w-64 shrink-0 self-start flex-col overflow-y-auto border-r border-[var(--panel-border)] px-4 py-6 lg:flex ${SIDEBAR_BG}`}>
        <div className="mb-8 px-1">
          <Brand initials={initials} name={name} />
        </div>
        <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] opacity-70">
          Menu
        </div>
        <NavLinks items={items} />
        <div className="mt-auto px-3 pt-8 text-xs text-[var(--text-muted)] opacity-60">KO Consultings</div>
      </aside>
    </>
  );
}
