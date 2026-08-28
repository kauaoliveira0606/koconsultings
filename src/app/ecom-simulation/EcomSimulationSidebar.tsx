"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/ecom-simulation/overview", label: "Overview" },
  { href: "/ecom-simulation/sales-team", label: "Sales Team" },
  { href: "/ecom-simulation/models", label: "Models" },
  { href: "/ecom-simulation/ads-analysis", label: "Ads Analysis" },
];

export function EcomSimulationSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 border-r border-black/10 bg-[#F1EEE4] p-4">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
          ES
        </div>
        <div>
          <div className="text-sm font-semibold">Ecom Simulation</div>
          <div className="text-xs text-black/50">Dashboard</div>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-black text-white" : "text-black/70 hover:bg-black/5"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
