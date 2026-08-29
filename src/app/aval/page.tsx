"use client";

import { useState } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardGrid, DashboardSection } from "@/components/dashboard/StatCardGrid";
import { RangeFilterBar, defaultRangeState, type RangeState } from "@/components/dashboard/RangeFilterBar";
import { useSectionData } from "@/lib/use-section-data";

type MetricsResponse = {
  sales: number | null;
  adSpend: number | null;
  totalCashCollected: number | null;
  pickupRate: number | null;
  pickups: number | null;
  costPerAcquisition: number | null;
  leadToCloseRate: number | null;
};

export default function AvalPage() {
  const [metricsRange, setMetricsRange] = useState<RangeState>(defaultRangeState("yesterday"));

  const { data: metrics } = useSectionData<MetricsResponse>("/api/aval/metrics", metricsRange);

  return (
    <div className="min-h-screen bg-[#F1EEE4] p-8 text-black">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Aval</h1>
        <RangeFilterBar value={metricsRange} onChange={setMetricsRange} />
      </div>

      <DashboardSection title="Metrics">
        <StatCardGrid>
          <StatCard label="Sales" value={metrics?.sales} format="number" />
          <StatCard label="Ad Spend" value={metrics?.adSpend} format="currency" />
          <StatCard label="Total Cash Collected" value={metrics?.totalCashCollected} format="currency" />
          <StatCard label="Pickup Rate" value={metrics?.pickupRate} format="percent" />
          <StatCard label="Pickups" value={metrics?.pickups} format="number" />
          <StatCard label="Cost Per Acquisition (CAC)" value={metrics?.costPerAcquisition} format="currency" />
          <StatCard label="Lead-to-Close Rate" value={metrics?.leadToCloseRate} format="percent" />
        </StatCardGrid>
      </DashboardSection>
    </div>
  );
}
