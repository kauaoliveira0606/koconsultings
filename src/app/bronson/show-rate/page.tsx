"use client";

import { ShowRateSection } from "@/components/dashboard/ShowRateSection";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";

/** Masterclass registrants: the AI texts back as Bronson to get them to show up live (user, 2026-10-28). */
export default function ShowRatePage() {
  const { range, setRange } = useSharedRange();
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Show Rate</h1>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>
      <ShowRateSection range={range} />
    </div>
  );
}
