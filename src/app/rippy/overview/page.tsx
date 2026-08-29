"use client";

import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";

export default function OverviewPage() {
  const { range, setRange } = useSharedRange();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Overview</h1>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>

      <DashboardSection title="Marketing Metrics">
        <div className="rounded-lg border border-black/10 bg-white p-6 text-sm text-black/50">
          No marketing data source is wired up for Rippy yet. Once that&apos;s in place, this
          page will mirror Bronson/Ecom Simulation&apos;s overview. Sales team numbers are live
          on the{" "}
          <a href="/rippy/sales-team" className="font-medium text-black underline">
            Sales Team
          </a>{" "}
          tab.
        </div>
      </DashboardSection>
    </div>
  );
}
