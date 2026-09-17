"use client";

import { useState } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardGrid, DashboardSection } from "@/components/dashboard/StatCardGrid";
import {
  RangeFilterBar,
  defaultRangeState,
  type RangeState,
} from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue } from "@/lib/format";
import { CashCalendar } from "./CashCalendar";
import { WeeklyScorecard } from "./WeeklyScorecard";

type MetricsResponse = {
  sales: number | null;
  adSpend: number | null;
  totalCashCollected: number | null;
  cashCollectedLowTicket: number | null;
  pickupRate: number | null;
  pickups: number | null;
  softwarePitched: number | null;
  pitchRate: number | null;
  cashCollectedPerOptInPaid: number | null;
  averageOrderValue: number | null;
  highTicketPitchRate: number | null;
  highTicketCloseRate: number | null;
  highTicketPitched: number | null;
  highTicketClosed: number | null;
  highTicketCallsBooked: number | null;
  highTicketCallsShowed: number | null;
  cashCollectedHighTicket: number | null;
  revenueHighTicket: number | null;
  costPerAcquisition: number | null;
  leadToCloseRate: number | null;
};

type LeadSourcesResponse = {
  paidLeadsTracked: number;
  organicLeadsTracked: number;
  cashCollectedPaid: number | null;
  cashCollectedOrganic: number | null;
  unattributedCash: number | null;
  unattributedCount: number;
  adSpend: number | null;
  paidRoas: number | null;
  costPerPaidLead: number | null;
  costPerAcquisitionPaid: number | null;
  pcn: {
    totalLogged: number;
    matchedToLead: number;
    paidClosed: number;
    organicClosed: number;
  };
};

type CrossCheckResponse = { mismatched: boolean; details: string[] };

type PlanSplitResponse = {
  monthly: number;
  yearly: number;
  unknown: number;
  total: number;
  yearlyShare: number | null;
};

type LeaderboardResponse = {
  rows: { id: string; name: string | null; entries: number | null }[];
};

type RecentChangesResponse = {
  days: {
    date: string;
    changesMadeToday: string;
  }[];
};

export default function OverviewPage() {
  const { range, setRange } = useSharedRange();
  const [planRange, setPlanRange] = useState<RangeState>(defaultRangeState("last_7_days"));

  const { data: metrics } = useSectionData<MetricsResponse>(
    "/api/ecom-simulation/overview/metrics",
    range
  );
  const { data: leadSources } = useSectionData<LeadSourcesResponse>(
    "/api/ecom-simulation/overview/lead-sources",
    range
  );
  const { data: crossCheck } = useSectionData<CrossCheckResponse>(
    "/api/ecom-simulation/overview/cross-check",
    range
  );
  const { data: leaderboard } = useSectionData<LeaderboardResponse>(
    "/api/ecom-simulation/overview/leaderboard",
    range
  );
  const { data: planSplit } = useSectionData<PlanSplitResponse>(
    "/api/ecom-simulation/overview/plan-split",
    planRange
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Overview</h1>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>

      <DashboardSection title="Metrics">
        <StatCardGrid>
          <StatCard label="Sales" value={metrics?.sales} format="number" />
          <StatCard label="Ad Spend" value={metrics?.adSpend} format="currency" />
          <StatCard label="Total Cash Collected" value={metrics?.totalCashCollected} format="currency" />
          <StatCard
            label="Cash Collected - Low Ticket"
            value={metrics?.cashCollectedLowTicket}
            format="currency"
          />
          <StatCard label="Pickup Rate" value={metrics?.pickupRate} format="percent" />
          <StatCard label="Pickups" value={metrics?.pickups} format="number" />
          <StatCard label="Software Pitched" value={metrics?.softwarePitched} format="number" />
          <StatCard
            label="Pitch Rate (Software Pitched / Pickups)"
            value={metrics?.pitchRate}
            format="percent"
          />
          <StatCard
            label="Cash Collected Per Opt-In (Paid)"
            value={metrics?.cashCollectedPerOptInPaid}
            format="currency"
          />
          <StatCard label="Average Order Value (AOV)" value={metrics?.averageOrderValue} format="currency" />
          <StatCard
            label="High Ticket Pitch Rate (HT Pitched / Sales)"
            value={metrics?.highTicketPitchRate}
            format="percent"
          />
          <StatCard label="Cost Per Acquisition (CAC)" value={metrics?.costPerAcquisition} format="currency" />
          <StatCard label="Lead-to-Close Rate" value={metrics?.leadToCloseRate} format="percent" />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="High Ticket Closers">
        <StatCardGrid>
          <StatCard label="Calls Booked" value={metrics?.highTicketCallsBooked} format="number" />
          <StatCard label="Calls Showed" value={metrics?.highTicketCallsShowed} format="number" />
          <StatCard label="Pitched" value={metrics?.highTicketPitched} format="number" />
          <StatCard label="Closed" value={metrics?.highTicketClosed} format="number" />
          <StatCard
            label="Close Rate (Closed / Pitched)"
            value={metrics?.highTicketCloseRate}
            format="percent"
          />
          <StatCard
            label="Cash Collected — High Ticket"
            value={metrics?.cashCollectedHighTicket}
            format="currency"
          />
          <StatCard label="Revenue — High Ticket" value={metrics?.revenueHighTicket} format="currency" />
        </StatCardGrid>
        <p className="mt-3 text-sm text-black/50">
          From the High Ticket Closers&apos; EOD log and Post Call Note, the closer&apos;s
          per-call record — active since 2026-09-13.
        </p>
      </DashboardSection>

      <DashboardSection
        title="Yearly / Monthly Plan Split"
        action={<RangeFilterBar value={planRange} onChange={setPlanRange} />}
      >
        {planSplit && planSplit.total > 0 ? (
          <StatCardGrid>
            <StatCard label="Monthly Plans" value={planSplit.monthly} format="number" />
            <StatCard label="Yearly Plans" value={planSplit.yearly} format="number" />
            <StatCard label="Total Closes" value={planSplit.total} format="number" />
            <StatCard
              label="Yearly Share"
              value={planSplit.yearlyShare}
              format="percent"
              subtext="Yearly ÷ total PCN closes"
            />
          </StatCardGrid>
        ) : (
          <div className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/50">
            No monthly or yearly plans in this range.
          </div>
        )}
      </DashboardSection>

      <DashboardSection title="Lead Sources">
        <StatCardGrid>
          <StatCard label="Paid Leads (Tracked)" value={leadSources?.paidLeadsTracked} format="number" />
          <StatCard label="Organic Leads (Tracked)" value={leadSources?.organicLeadsTracked} format="number" />
          <StatCard
            label="Cash Collected — Paid"
            value={leadSources?.cashCollectedPaid}
            format="currency"
            subtext="Affiliate PCN closes matched to a lead by email, plus any lead's own Cash Collected value"
          />
          <StatCard
            label="Cash Collected — Organic"
            value={leadSources?.cashCollectedOrganic}
            format="currency"
            subtext="Affiliate PCN closes matched to a lead by email, plus any lead's own Cash Collected value"
          />
          <StatCard
            label="Ad Spend"
            value={leadSources?.adSpend}
            format="currency"
            subtext="From Marketing Daily Metrics (Ad Spend Meta)"
          />
          <StatCard
            label="Paid ROAS"
            value={leadSources?.paidRoas}
            format="ratio"
            subtext="Cash (Paid) ÷ Ad Spend"
          />
          <StatCard
            label="Cost Per Paid Lead"
            value={leadSources?.costPerPaidLead}
            format="currency"
            subtext="Ad Spend ÷ tracked Paid leads"
          />
          <StatCard
            label="CPA — Paid"
            value={leadSources?.costPerAcquisitionPaid}
            format="currency"
            subtext="Ad Spend ÷ Paid leads that actually closed"
          />
        </StatCardGrid>

        {crossCheck?.mismatched ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <span className="font-semibold">Cross-check mismatch:</span> the Marketing Daily
            Metrics form&apos;s manually-typed opt-ins don&apos;t match the tracked lead count for
            this range — {crossCheck.details.join("; ")}. Worth checking whether the source
            tagging is firing correctly or the manual entry is stale.
          </div>
        ) : null}

        <div className="mt-4 rounded-lg border border-black/10 bg-white p-4 text-sm">
          <p className="text-black/70">
            {leadSources ? (
              <>
                <span className="font-semibold">{leadSources.pcn.matchedToLead}</span>/
                {leadSources.pcn.totalLogged} Affiliate PCN calls in this range matched a lead by
                email ({leadSources.pcn.paidClosed} paid closes, {leadSources.pcn.organicClosed}{" "}
                organic closes attributed above).
              </>
            ) : null}
          </p>
          {leadSources?.unattributedCount ? (
            <p className="mt-2 text-black/50">
              <span className="font-semibold text-black/70">
                {formatStatValue(leadSources.unattributedCash, "currency")}
              </span>{" "}
              from {leadSources.unattributedCount} closed{" "}
              {leadSources.unattributedCount === 1 ? "call" : "calls"} couldn&apos;t be matched to
              a lead email, so it&apos;s not counted above as Paid or Organic.
            </p>
          ) : null}
        </div>
      </DashboardSection>

      <DashboardSection title="Cash Calendar">
        <CashCalendar />
      </DashboardSection>

      <DashboardSection title="Leaderboard">
        {leaderboard && leaderboard.rows.length > 0 ? (
          <div className="rounded-lg border border-black/10 bg-white p-4">
            <ol className="space-y-2">
              {leaderboard.rows.map((row, i) => (
                <li key={row.id} className="flex items-center justify-between text-sm">
                  <span>
                    {i + 1}. {row.name ?? "Unknown"}
                  </span>
                  <span className="font-semibold">{row.entries ?? "—"}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/50">
            No submissions in this range.
          </div>
        )}
      </DashboardSection>

      <RecentChanges />

      <WeeklyScorecard />
    </div>
  );
}

function RecentChanges() {
  const { data } = useSectionData<RecentChangesResponse>(
    "/api/ecom-simulation/overview/recent-changes",
    defaultRangeState("all_time")
  );

  return (
    <DashboardSection title="Recent Changes">
      <p className="mb-3 text-sm text-black/50">
        Each &quot;Changes Made Today&quot; note from the Marketing Daily Metrics form.
      </p>
      {data && data.days.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.days.map((day) => (
            <div key={day.date} className="rounded-lg border border-black/10 bg-white p-4">
              <div className="mb-2 text-xs font-semibold uppercase text-black/60">{day.date}</div>
              <p className="whitespace-pre-wrap border-l-2 border-[var(--accent)] pl-3 text-sm">
                {day.changesMadeToday}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/50">
          No &quot;Changes Made Today&quot; notes logged in the last 14 days.
        </div>
      )}
    </DashboardSection>
  );
}
