"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** A nav item with its colored icon tile. */
type Item = { href: string; label: string; icon: keyof typeof ICONS; color: string };
type Group = { label?: string; items: Item[] };

/** Line icons, 20x20 viewBox, keyed by name. */
const ICONS = {
  overview: <path d="M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z" />,
  ads: <path d="M3.5 16.5V9M8.5 16.5V4M13.5 16.5v-5M17 16.5H2.5" />,
  funnel: <path d="M3 4.5h14l-5 6v5l-4 2v-7l-5-6z" />,
  sales: <path d="M3.5 5h13v11.5h-13zM3.5 8.5h13M5.5 12h4" />,
  scorecard: <path d="M10 17a7 7 0 100-14 7 7 0 000 14zm0-3.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm0-2.5a1 1 0 100-2 1 1 0 000 2z" />,
  integrations: <path d="M8 4V2.5M12 4V2.5M8 16v1.5M12 16v1.5M4 8H2.5M4 12H2.5M16 8h1.5M16 12h1.5M5.5 5.5h9v9h-9z" />,
  office: <path d="M3.5 7.5h13v9h-13zM7 7.5V4.5a1 1 0 011-1h4a1 1 0 011 1v3M3.5 11h13" />,
  calendar: <path d="M3.5 5h13v11.5h-13zM3.5 8.5h13M7 3v3.5M13 3v3.5" />,
  team: <path d="M7.5 9a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5zM2.5 16.5c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5M13.5 9a2.25 2.25 0 100-4.5M14.5 12.2c1.8.4 3 1.8 3 4.3" />,
  coins: <path d="M10 2.5v15M13.5 5.5H8.25a2.25 2.25 0 000 4.5h3.5a2.25 2.25 0 010 4.5H6" />,
  payments: <path d="M2.5 5h15v10h-15zM2.5 8.5h15M5.5 12.5h3" />,
  upsell: <path d="M3 14.5l4.5-4.5 3 3L17 6.5M12.5 6.5H17V11" />,
  models: <path d="M10 2.5l7 4-7 4-7-4 7-4zM3 10l7 4 7-4M3 13.5l7 4 7-4" />,
  shield: <path d="M10 2.5l6 2.5v4.5c0 4-2.6 6.8-6 8-3.4-1.2-6-4-6-8V5l6-2.5z" />,
  phone2: <path d="M5.5 3h2.2l1.2 3.2-1.6 1.1a8 8 0 004.4 4.4l1.1-1.6 3.2 1.2v2.2a1.5 1.5 0 01-1.6 1.5C8.4 14.6 5.4 11.6 4 5.1A1.5 1.5 0 015.5 3z" />,
  webinars: <path d="M2.5 3.5h15v10h-15zM7 17h6M10 13.5V17M8.5 6.5v4l3.5-2-3.5-2z" />,
  eye: <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10zM10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />,
  ghost: <path d="M4 16.5V8a6 6 0 0112 0v8.5l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5zM8 8.5h0M12 8.5h0" />,
  formats: <path d="M3.5 4.5h13v11h-13zM3.5 8h13M8 8v7.5" />,
  book: <path d="M4 3.5h9.5a2 2 0 012 2V16.5H6a2 2 0 01-2-2v-11zM4 14.5a2 2 0 012-2h9.5M7.5 7h5M7.5 9.5h3.5" />,
  phone: <path d="M6 2.5h8a1 1 0 011 1v13a1 1 0 01-1 1H6a1 1 0 01-1-1v-13a1 1 0 011-1zM8.5 15h3" />,
  claude: <path d="M10 3.5l1.8 4.7 4.7 1.8-4.7 1.8L10 16.5l-1.8-4.7L3.5 10l4.7-1.8z" />,
} as const;

function Tile({ name, color }: { name: keyof typeof ICONS; color: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-white ring-1 ring-black/5"
      style={{ background: color }}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[name]}
      </svg>
    </span>
  );
}

// Solid, saturated tile colors: crisp white glyphs read clearly on these.
const B = {
  blue: "#2563eb",
  orange: "#ea580c",
  purple: "#7c3aed",
  green: "#059669",
  teal: "#0d9488",
  slate: "#334155",
  indigo: "#4f46e5",
  pink: "#db2777",
  amber: "#d97706",
  rose: "#e11d48",
  claude: "#c2552f",
};

const GROUPS: Group[] = [
  {
    label: "Workspace",
    items: [
      { href: "/bronson/overview", label: "Overview", icon: "overview", color: B.blue },
      { href: "/bronson/ads", label: "Ads", icon: "ads", color: B.orange },
      { href: "/bronson/funnels", label: "Funnel", icon: "funnel", color: B.purple },
      { href: "/bronson/sales", label: "Sales", icon: "sales", color: B.green },
      { href: "/bronson/scorecard", label: "Scorecard", icon: "scorecard", color: B.teal },
      { href: "/bronson/integrations", label: "Integrations", icon: "integrations", color: B.slate },
    ],
  },
  {
    label: "Dashboard",
    items: [
      { href: "/bronson/cash-calendar", label: "Cash Calendar", icon: "calendar", color: B.green },
      { href: "/bronson/sales-team", label: "Sales Team", icon: "team", color: B.indigo },
      { href: "/bronson/commissions", label: "Commissions", icon: "coins", color: B.amber },
      { href: "/bronson/payment-plans", label: "Payment Plans", icon: "payments", color: B.teal },
      { href: "/bronson/upsell-potential", label: "Upsell Potential", icon: "upsell", color: B.rose },
      { href: "/bronson/models", label: "Models", icon: "models", color: B.purple },
      { href: "/bronson/admin-team", label: "Admin Team", icon: "shield", color: B.slate },
      { href: "/bronson/live-calls", label: "Live Calls", icon: "phone2", color: B.blue },
    ],
  },
  {
    label: "Webinars",
    items: [
      { href: "/bronson/webinars", label: "Webinars", icon: "webinars", color: B.indigo },
      { href: "/bronson/show-rate", label: "Show Rate", icon: "eye", color: B.teal },
      { href: "/bronson/no-shows", label: "No-Shows", icon: "ghost", color: B.rose },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/bronson/ad-formats", label: "Ad formats", icon: "formats", color: B.pink },
      { href: "/bronson/knowledge-base", label: "Knowledge Base", icon: "book", color: B.amber },
      { href: "/bronson/office", label: "Office", icon: "office", color: B.indigo },
      { href: "/bronson/phone", label: "Phone app", icon: "phone", color: B.slate },
    ],
  },
  {
    label: "Your Claude",
    items: [{ href: "/bronson/connect", label: "Connect Claude", icon: "claude", color: B.claude }],
  },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/bronson/overview") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function Body({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-sm font-black text-white">B</span>
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight text-neutral-900">BERLIN</div>
          <div className="text-[9px] uppercase tracking-[0.12em] text-neutral-400">Metrics and numbers on screen</div>
        </div>
      </div>

      {/* Workspace chip */}
      <div className="mx-1 mb-3 flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-2 shadow-sm">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-xs font-bold text-white">BN</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-semibold text-neutral-900">BRONSON</div>
          <div className="truncate text-[11px] text-neutral-400">Client &middot; Base44 funnel</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 8l3-3 3 3M7 12l3 3 3-3" />
        </svg>
      </div>

      {/* Search */}
      <div className="mx-1 mb-4 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-400">
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="9" cy="9" r="6" />
          <path d="M14 14l3.5 3.5" />
        </svg>
        <span className="flex-1">Search</span>
        <span className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">Ctrl K</span>
      </div>

      {/* Groups */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-1 pb-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            {group.label ? (
              <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">{group.label}</div>
            ) : null}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-[15px] font-semibold transition-colors ${
                      active ? "bg-neutral-100 text-neutral-900 ring-1 ring-inset ring-neutral-200" : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                  >
                    <Tile name={item.icon} color={item.color} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User chip */}
      <div className="mt-auto flex items-center gap-2.5 border-t border-neutral-200 px-2 pt-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-700">K</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-semibold text-neutral-900">Kaua</div>
          <div className="truncate text-[11px] text-neutral-400">kaua.bage@gmail.com</div>
        </div>
      </div>
    </div>
  );
}

export function BerlinSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-neutral-200 bg-white p-3 lg:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-xs font-black text-white">B</span>
          <span className="text-sm font-extrabold tracking-tight text-neutral-900">BERLIN</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 overflow-y-auto border-r border-neutral-200 bg-white p-3 shadow-2xl">
            <Body onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 self-start flex-col overflow-y-auto border-r border-neutral-200 bg-white px-3 py-5 lg:flex">
        <Body />
      </aside>
    </>
  );
}
