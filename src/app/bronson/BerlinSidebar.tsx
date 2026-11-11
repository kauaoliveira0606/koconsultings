"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type LucideIcon,
  LayoutDashboard,
  Megaphone,
  Filter,
  Target,
  Plug,
  CalendarDays,
  Users,
  CreditCard,
  TrendingUp,
  Layers,
  ShieldCheck,
  PhoneCall,
  MonitorPlay,
  Eye,
  UserX,
  Clapperboard,
  BookOpen,
  Briefcase,
  Search as SearchIcon,
  ChevronsUpDown,
  LogOut,
  Brain,
  Rocket,
  Sparkles,
} from "lucide-react";
import { SALES_PAGES, type Role } from "@/lib/admin-gate";

type Item = { href: string; label: string; icon: LucideIcon; color: string };
type Group = { label?: string; items: Item[] };

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

function Tile({ Icon, color }: { Icon: LucideIcon; color: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ring-1 ring-black/5" style={{ background: color }}>
      <Icon size={17} strokeWidth={2.25} color="#ffffff" />
    </span>
  );
}

const GROUPS: Group[] = [
  // Office sits on its own above Workspace (user's reference, 2026-11-10).
  { items: [{ href: "/bronson/office", label: "Office", icon: Briefcase, color: B.indigo }] },
  {
    label: "Workspace",
    items: [
      { href: "/bronson/overview", label: "Overview", icon: LayoutDashboard, color: B.blue },
      { href: "/bronson/scorecard", label: "Scorecard", icon: Target, color: B.teal },
      { href: "/bronson/cash-calendar", label: "Cash Calendar", icon: CalendarDays, color: B.green },
      { href: "/bronson/integrations", label: "Integrations", icon: Plug, color: B.slate },
      { href: "/bronson/feedback", label: "Feedback", icon: Sparkles, color: B.claude },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/bronson/ads", label: "Ads", icon: Megaphone, color: B.orange },
      { href: "/bronson/funnels", label: "Funnel", icon: Filter, color: B.purple },
      { href: "/bronson/ad-formats", label: "Ad formats", icon: Clapperboard, color: B.pink },
      { href: "/bronson/copy-check", label: "Copy check", icon: ShieldCheck, color: B.green },
      { href: "/bronson/launch", label: "Launch", icon: Rocket, color: B.orange },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/bronson/sales-team", label: "Sales Team", icon: Users, color: B.indigo },
      { href: "/bronson/live-calls", label: "Live Calls", icon: PhoneCall, color: B.blue },
      { href: "/bronson/payment-plans", label: "Payment Plans", icon: CreditCard, color: B.teal },
      { href: "/bronson/upsell-potential", label: "Upsell Potential", icon: TrendingUp, color: B.rose },
      { href: "/bronson/models", label: "Models", icon: Layers, color: B.purple },
      { href: "/bronson/admin-team", label: "Admin Team", icon: ShieldCheck, color: B.slate },
      { href: "/bronson/knowledge-base", label: "Knowledge Base", icon: BookOpen, color: B.amber },
    ],
  },
  {
    label: "Webinars",
    items: [
      { href: "/bronson/webinars", label: "Webinars", icon: MonitorPlay, color: B.indigo },
      { href: "/bronson/show-rate", label: "Show Rate", icon: Eye, color: B.teal },
      { href: "/bronson/no-shows", label: "No-Shows", icon: UserX, color: B.rose },
    ],
  },
  {
    label: "Skills and SOPs",
    items: [{ href: "/bronson/brain", label: "Skills and SOPs", icon: Brain, color: B.purple }],
  },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/bronson/overview") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

/** Sales Team only sees the tabs the proxy lets them open; admins see everything. */
function groupsFor(role: Role): Group[] {
  if (role === "admin") return GROUPS;
  return GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => SALES_PAGES.includes(i.href)) })).filter((g) => g.items.length);
}

async function logout() {
  await fetch("/api/login", { method: "DELETE" });
  window.location.href = "/login";
}

function Body({ onNavigate, role }: { onNavigate?: () => void; role: Role }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-sm font-black text-white">B</span>
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight text-neutral-900">BERLIN</div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Metrics and numbers on screen</div>
        </div>
      </div>

      {/* Workspace chip */}
      <div className="mx-1 mb-3 flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-2 shadow-sm">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-xs font-bold text-white">BN</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-bold text-neutral-900">BRONSON</div>
          <div className="truncate text-[11px] text-neutral-500">Client &middot; Base44 funnel</div>
        </div>
        <ChevronsUpDown size={14} className="text-neutral-400" />
      </div>

      {/* Search */}
      <div className="mx-1 mb-4 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-400">
        <SearchIcon size={15} strokeWidth={2.25} />
        <span className="flex-1 font-medium">Search</span>
        <span className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400">Ctrl K</span>
      </div>

      {/* Groups */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-1 pb-4">
        {groupsFor(role).map((group) => (
          <div key={group.label ?? group.items[0].href}>
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
                    <Tile Icon={item.icon} color={item.color} />
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
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-700">
          {role === "admin" ? "A" : "S"}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-bold text-neutral-900">{role === "admin" ? "Admin Team" : "Sales Team"}</div>
          <div className="truncate text-[11px] text-neutral-500">Logged in</div>
        </div>
        <button
          type="button"
          onClick={logout}
          aria-label="Log out"
          title="Log out"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <LogOut size={16} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}

export function BerlinSidebar({ role }: { role: Role }) {
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
            <Body onNavigate={() => setOpen(false)} role={role} />
          </aside>
        </div>
      ) : null}

      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 self-start flex-col overflow-y-auto border-r border-neutral-200 bg-white px-3 py-5 lg:flex">
        <Body role={role} />
      </aside>
    </>
  );
}
