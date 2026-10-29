"use client";

import { NoShowSection } from "@/components/dashboard/NoShowSection";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";

/** Masterclass no-shows: the AI texts them as Bronson, no guilt, and saves their seat for the next one (user, 2026-10-28). */
export default function NoShowsPage() {
  const { range, setRange } = useSharedRange();
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">No-Shows</h1>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>
      <NoShowSection offer="bronson" range={range} />
    </div>
  );
}
