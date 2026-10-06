"use client";

import { CommissionsBoard } from "@/components/dashboard/CommissionsBoard";
import { DataCheckSection } from "@/components/dashboard/DataCheckSection";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { useSharedRange } from "@/lib/range-context";

/** Owner / admin only views, kept off the tabs the sales team works from. */
export default function AdminTeamPage() {
  const { range, setRange } = useSharedRange();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Admin Team</h1>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>

      <DashboardSection title="Data Check">
        <DataCheckSection apiPath="/api/bronson/admin-team/data-check" range={range} />
      </DashboardSection>

      <div className="mt-10 border-t border-[var(--panel-border)] pt-8">
      <CommissionsBoard
        apiPath="/api/bronson/commissions"
        payPeriods={{ firstMonth: "2026-08", firstMonthSplitDay: 21 }}
      />
      </div>
    </div>
  );
}
