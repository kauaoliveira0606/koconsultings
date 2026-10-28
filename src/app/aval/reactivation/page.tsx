"use client";

import { ReactivationSection } from "@/components/dashboard/ReactivationSection";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";

/** Its own tab (user, 2026-10-28): the AI texting engine that reactivates cold Base44 leads. */
export default function ReactivationPage() {
  const { range, setRange } = useSharedRange();
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Reactivation</h1>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>
      <ReactivationSection offer="aval" range={range} />
    </div>
  );
}
