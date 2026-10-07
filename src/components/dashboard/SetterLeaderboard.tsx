"use client";

import {
  LeaderboardCards,
  kpi,
  type LeaderboardEntry,
} from "@/components/dashboard/LeaderboardCards";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { formatStatValue } from "@/lib/format";
import type { GoalsConfig } from "@/lib/goals";
import type { SetterLeaderboardResponse, SetterStats } from "@/lib/setter-leaderboard";
import { useSectionData } from "@/lib/use-section-data";

const pct = (v: number) => `${Math.round(v * 100)}%`;

function talkTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
}

function entry(s: SetterStats, goals: GoalsConfig | undefined): LeaderboardEntry {
  const closeGoal = goals?.closeRateLowTicket?.min;
  const showGoal = goals?.showRate?.min;
  return {
    name: s.setter,
    hero: { label: "Cash Collected", value: s.cash, format: "currency" },
    sub: `${formatStatValue(s.cashLowTicket, "currency")} low ticket · ${formatStatValue(s.cashHighTicket, "currency")} high ticket`,
    groups: [
      {
        title: "Activity",
        rows: [
          { label: "Dials", value: s.dials, format: "number" },
          { label: "Pickups", value: s.pickups, format: "number" },
          { label: "Software Pitched", value: s.softwarePitched, format: "number" },
          { label: "Software Closed", value: s.softwareClosed, format: "number" },
          { label: "Talk Time", value: s.talkMinutes, format: "number", text: talkTime(s.talkMinutes) },
        ],
      },
      {
        title: "Rates",
        rows: [
          { label: "Pickup Rate", value: s.pickupRate, format: "percent", note: "Pickups ÷ dials" },
          { label: "Pitch Rate", value: s.pitchRate, format: "percent", note: "Pitched ÷ pickups" },
          {
            label: "Close Rate",
            value: s.closeRate,
            format: "percent",
            note: "Closed ÷ pitched",
            status: kpi(s.closeRate, closeGoal, "atLeast"),
            goal: closeGoal ? `≥ ${pct(closeGoal)}` : undefined,
          },
        ],
      },
      {
        title: "High Ticket Setting",
        rows: [
          { label: "HT Calls Pitched", value: s.highTicketPitched, format: "number" },
          {
            label: "HT Pitch Rate",
            value: s.highTicketPitchRate,
            format: "percent",
            note: "Pitched HT calls ÷ software closes",
          },
          { label: "HT Calls Booked", value: s.highTicketBooked, format: "number" },
          {
            label: "Show Rate",
            value: s.highTicketShowRate,
            format: "percent",
            note: `${s.highTicketShowed} showed`,
            status: kpi(s.highTicketShowRate, showGoal, "atLeast"),
            goal: showGoal ? `≥ ${pct(showGoal)}` : undefined,
          },
          { label: "HT Sets Closed", value: s.highTicketSetClosed, format: "number" },
        ],
      },
      {
        title: "Cash",
        rows: [
          { label: "Cash Collected", value: s.cash, format: "currency" },
          { label: "AOV", value: s.aov, format: "currency", note: "Low ticket cash ÷ software closed" },
          {
            label: "Cash Per Booked Call",
            value: s.cashPerBookedCall,
            format: "currency",
            note: "High ticket cash ÷ HT calls booked",
          },
        ],
      },
      {
        title: "Pay",
        rows: [
          { label: "Commission MTD", value: s.commissionMtd, format: "currency" },
          {
            label: "Effective Hourly Rate",
            value: s.effectiveHourlyRate,
            format: "currency",
            note: "Commission ÷ hours of talk time, this month",
          },
          {
            label: "Hourly Rate (Company)",
            value: s.companyHourlyRate,
            format: "currency",
            note: "Cash ÷ hours of talk time",
          },
        ],
      },
    ],
  };
}

/**
 * Leaderboard for the setting team: one card per setter, ranked by cash
 * collected in the selected range. Same layout as the Closer Leaderboard.
 */
export function SetterLeaderboard({
  apiPath,
  range,
  goals,
}: {
  apiPath: string;
  range: RangeState;
  goals: GoalsConfig | undefined;
}) {
  const { data } = useSectionData<SetterLeaderboardResponse>(apiPath, range);
  return (
    <LeaderboardCards
      entries={data?.setters.map((s) => entry(s, goals))}
      team={data ? entry(data.team, goals) : undefined}
      emptyText="No setter EOD reports in this range."
      footnote={`Setters, ranked by cash collected (${formatStatValue(data?.team.cash, "currency")} as a team). A 🥇 on a line marks who is #1 on that metric. Everything comes from each setter's Affiliate EOD report. Commission MTD and the setter's own hourly rate are for this calendar month, whatever range is selected.`}
    />
  );
}
