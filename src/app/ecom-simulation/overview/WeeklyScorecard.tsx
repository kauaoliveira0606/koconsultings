"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardGrid, DashboardSection } from "@/components/dashboard/StatCardGrid";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue, type StatFormat } from "@/lib/format";

type ScorecardEntry = {
  key: string;
  label: string;
  actual: number | null;
  goal: number | null;
  higherIsBetter: boolean;
  format: StatFormat;
};

type WeeklyScorecardResponse = {
  leadingMetrics: ScorecardEntry[];
  leadFlow: ScorecardEntry[];
  salesConversion: ScorecardEntry[];
  marketingMetrics: ScorecardEntry[];
  backend: ScorecardEntry[];
  summary: string;
};

function goalLabel(entry: ScorecardEntry): string | null {
  if (entry.goal === null) return null;
  const formatted = formatStatValue(entry.goal, entry.format);
  return `Goal: ${formatted}${entry.higherIsBetter ? "+" : "<"}`;
}

function Group({ emoji, title, entries }: { emoji: string; title: string; entries: ScorecardEntry[] }) {
  return (
    <div className="mt-4 first:mt-0">
      <h3 className="mb-2 text-xs font-semibold uppercase text-black/60">
        {emoji} {title}
      </h3>
      <StatCardGrid>
        {entries.map((entry) => (
          <StatCard
            key={entry.key}
            label={entry.label}
            value={entry.actual}
            format={entry.format}
            goal={goalLabel(entry)}
          />
        ))}
      </StatCardGrid>
    </div>
  );
}

export function WeeklyScorecard() {
  const { range } = useSharedRange();
  const { data } = useSectionData<WeeklyScorecardResponse>(
    "/api/ecom-simulation/overview/weekly-scorecard",
    range
  );

  return (
    <DashboardSection title="Weekly Scorecard">
      {data ? (
        <>
          <Group emoji="💰" title="Leading Metrics" entries={data.leadingMetrics} />
          <Group emoji="🔥" title="Lead Flow" entries={data.leadFlow} />
          <Group emoji="🤝" title="Sales Conversion" entries={data.salesConversion} />
          <Group emoji="🚩" title="Marketing Metrics" entries={data.marketingMetrics} />
          <Group emoji="📊" title="Backend" entries={data.backend} />

          <div className="mt-4 rounded-lg border border-black/10 bg-white p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                ✦
              </span>
              <span className="text-sm font-semibold">Weekly Intelligence Summary</span>
            </div>
            <p className="mb-2 text-xs text-black/40">Based on live scorecard data — rule-based, not AI-generated</p>
            <p className="text-sm text-black/70">{data.summary}</p>
          </div>
        </>
      ) : null}
    </DashboardSection>
  );
}
