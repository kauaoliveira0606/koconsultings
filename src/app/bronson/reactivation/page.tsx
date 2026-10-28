"use client";

import { ReactivationSection } from "@/components/dashboard/ReactivationSection";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";

/** The AI texting engine that reactivates old Base44 free course opt-ins (GHL Affiliate pipeline). */
export default function ReactivationPage() {
  const { range, setRange } = useSharedRange();
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Reactivation</h1>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>
      <ReactivationSection offer="bronson" range={range} />
    </div>
  );
}
