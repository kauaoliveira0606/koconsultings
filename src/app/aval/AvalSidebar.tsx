"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/aval/overview", label: "Overview" },
  { href: "/aval/sales-team", label: "Sales Team" },
  { href: "/aval/models", label: "Models" },
  { href: "/aval/ads-analysis", label: "Ads Analysis" },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-black">
        AV
      </div>
      <div>
        <div className="text-sm font-semibold text-white">Aval</div>
        <div className="text-xs text-white/50">Dashboard</div>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-emerald-500 text-black" : "text-white/70 hover:bg-white/10"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AvalSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0A0E14] p-4 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white/70 hover:bg-white/10"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col gap-8 bg-[#0A0E14] p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white/70 hover:bg-white/10"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-52 shrink-0 border-r border-white/10 bg-[#0A0E14] p-4 lg:block">
        <div className="mb-8">
          <Brand />
        </div>
        <NavLinks />
      </aside>
    </>
  );
}
