"use client";

import {
  LeaderboardCards,
  kpi,
  type LeaderboardEntry,
} from "@/components/dashboard/LeaderboardCards";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import type { CloserLeaderboardResponse, CloserStats } from "@/lib/closer-leaderboard";
import { formatStatValue } from "@/lib/format";
import type { GoalsConfig } from "@/lib/goals";
import { useSectionData } from "@/lib/use-section-data";

/** Disqualified calls should stay under this share of showed calls. */
const DQ_RATE_MAX = 0.2;

const pct = (v: number) => `${Math.round(v * 100)}%`;

function entry(c: CloserStats, goals: GoalsConfig | undefined): LeaderboardEntry {
  const showGoal = goals?.showRate?.min;
  const closeGoal = goals?.highTicketCloseRate?.min;
  return {
    name: c.closer,
    hero: { label: "Cash Collected", value: c.cash, format: "currency" },
    sub: `${c.won} won from ${c.show} showed call${c.show === 1 ? "" : "s"}`,
    groups: [
      {
        title: "Funnel",
        rows: [
          { label: "Leads", value: c.leads, format: "number", note: "Booked + cancelled" },
          { label: "Calls", value: c.calls, format: "number" },
          { label: "Show", value: c.show, format: "number" },
          { label: "Qualified", value: c.qualified, format: "number" },
          { label: "Won", value: c.won, format: "number" },
        ],
      },
      {
        title: "Rates",
        rows: [
          {
            label: "Show %",
            value: c.showRate,
            format: "percent",
            status: kpi(c.showRate, showGoal, "atLeast"),
            goal: showGoal ? `≥ ${pct(showGoal)}` : undefined,
          },
          {
            label: "DQ Rate",
            value: c.dqRate,
            format: "percent",
            status: kpi(c.dqRate, DQ_RATE_MAX, "under"),
            goal: `under ${pct(DQ_RATE_MAX)}`,
          },
          {
            label: "Show To Close %",
            value: c.showToClose,
            format: "percent",
            status: kpi(c.showToClose, closeGoal, "atLeast"),
            goal: closeGoal ? `≥ ${pct(closeGoal)}` : undefined,
          },
          { label: "Leads To Close", value: c.leadsToClose, format: "percent" },
        ],
      },
      {
        title: "Cash",
        rows: [
          { label: "Cash Per Call", value: c.cashPerCall, format: "currency" },
          { label: "Cash Per Lead", value: c.cashPerLead, format: "currency" },
          { label: "Booked Revenue", value: c.bookedRevenue, format: "currency", note: "Reference only" },
        ],
      },
      {
        title: "Pay",
        rows: [
          { label: "Commission MTD", value: c.commissionMtd, format: "currency" },
          {
            label: "Effective Hourly Rate",
            value: c.effectiveHourlyRate,
            format: "currency",
            note: "Commission ÷ calls shown, this month",
          },
          {
            label: "Hourly Rate (Company)",
            value: c.companyHourlyRate,
            format: "currency",
            note: "Cash ÷ calls shown",
          },
        ],
      },
    ],
  };
}

/**
 * Leaderboard for the high ticket closers: one card per closer, ranked by
 * cash collected in the selected range.
 */
export function CloserLeaderboard({
  apiPath,
  range,
  goals,
}: {
  apiPath: string;
  range: RangeState;
  goals: GoalsConfig | undefined;
}) {
  const { data } = useSectionData<CloserLeaderboardResponse>(apiPath, range);
  return (
    <LeaderboardCards
      entries={data?.closers.map((c) => entry(c, goals))}
      team={data ? entry(data.team, goals) : undefined}
      emptyText="No closer EOD reports in this range."
      footnote={`High ticket closers, ranked by cash collected (${formatStatValue(data?.team.cash, "currency")} as a team). Counts and cash come from each closer's EOD report. Commission MTD and the closer's own hourly rate are for this calendar month, whatever range is selected.`}
    />
  );
}
