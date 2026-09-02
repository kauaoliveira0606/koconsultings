"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardGrid, DashboardSection } from "@/components/dashboard/StatCardGrid";
import { AttributionSection } from "@/components/dashboard/AttributionSection";
import { RangeFilterBar, defaultRangeState } from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue, type StatFormat } from "@/lib/format";
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
  upsellBookingRate: number | null;
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


type RecentChangesResponse = {
  days: {
    date: string;
    hasSubmission: boolean;
    changesMadeToday: string | null;
    metrics: Record<string, number | null> | null;
  }[];
};

const RECENT_CHANGES_LABELS: Record<string, string> = {
  adSpend: "Ad Spend",
  costPerLead: "Cost / Lead",
  optInsPaid: "Opt-ins (Paid)",
  optInsOrganic: "Opt-ins (Organic)",
  landingPageConnectRate: "LP Connect Rate",
  vslViews: "VSL Views",
  vslPlayRate: "VSL Play Rate",
  vslEngagementRate: "VSL Engagement",
  emailOpenRate: "Email Open Rate",
  dials: "Dials",
  connectionRate: "Connection Rate",
  sales: "Sales",
  cashCollected: "Cash Collected",
  closeRate: "Close Rate",
  funnelConversionRate: "Funnel Conv. Rate",
};

const RECENT_CHANGES_FORMATS: Record<string, StatFormat> = {
  adSpend: "currency",
  costPerLead: "currency",
  optInsPaid: "number",
  optInsOrganic: "number",
  landingPageConnectRate: "percent",
  vslViews: "number",
  vslPlayRate: "percent",
  vslEngagementRate: "percent",
  emailOpenRate: "percent",
  dials: "number",
  connectionRate: "percent",
  sales: "number",
  cashCollected: "currency",
  closeRate: "percent",
  funnelConversionRate: "percent",
};

export default function OverviewPage() {
  const { range, setRange } = useSharedRange();

  const { data: metrics } = useSectionData<MetricsResponse>("/api/bronson/overview/metrics", range);
  const { data: leadSources } = useSectionData<LeadSourcesResponse>(
    "/api/bronson/overview/lead-sources",
    range
  );
  const { data: crossCheck } = useSectionData<CrossCheckResponse>(
    "/api/bronson/overview/cross-check",
    range
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Overview</h1>
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
          <StatCard
            label="Upsell Booking Rate (HT Booked / HT Pitched)"
            value={metrics?.upsellBookingRate}
            format="percent"
          />
          <StatCard label="Cost Per Acquisition (CAC)" value={metrics?.costPerAcquisition} format="currency" />
          <StatCard label="Lead-to-Close Rate" value={metrics?.leadToCloseRate} format="percent" />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="Attribution — Base 44 + Wix">
        <AttributionSection
          apiPath="/api/bronson/overview/attribution"
          brandLabel="Base 44 + Wix"
          theme="deepspace"
        />
      </DashboardSection>

      <DashboardSection title="Yearly / Monthly Plan Split">
        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-sm text-[var(--text-muted)] backdrop-blur-sm">
          No monthly or yearly plans in this range.
        </div>
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
          <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-200">
            <span className="font-semibold">Cross-check mismatch:</span> the Marketing Daily
            Metrics form&apos;s manually-typed opt-ins don&apos;t match the tracked lead count for
            this range — {crossCheck.details.join("; ")}. Worth checking whether the source
            tagging is firing correctly or the manual entry is stale.
          </div>
        ) : null}

        <div className="mt-4 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-sm backdrop-blur-sm">
          <p className="text-[var(--text)]">
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
            <p className="mt-2 text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text)]">
                {formatStatValue(leadSources.unattributedCash, "currency")}
              </span>{" "}
              from {leadSources.unattributedCount} closed{" "}
              {leadSources.unattributedCount === 1 ? "call" : "calls"} couldn&apos;t be matched to
              a lead email, so it&apos;s not counted above as Paid or Organic.
            </p>
          ) : null}
        </div>
      </DashboardSection>

      <RecentChanges />

      <WeeklyScorecard />
    </div>
  );
}

function RecentChanges() {
  const { data } = useSectionData<RecentChangesResponse>(
    "/api/bronson/overview/recent-changes",
    defaultRangeState("all_time")
  );

  return (
    <DashboardSection title="Recent Changes — Last 3 Days">
      <p className="mb-3 text-sm text-[var(--text-muted)]">
        Whatever is logged in the Marketing Daily Metrics form&apos;s &quot;Changes Made
        Today&quot; field shows up here next to that day&apos;s actual numbers, so you can see
        what moved.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {data?.days.map((day, i) => (
          <div
            key={day.date}
            className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm"
          >
            <div className="mb-2 text-xs font-semibold uppercase text-[var(--text-muted)]">
              {i === 0 ? "Today" : i === 1 ? "Yesterday" : ""} — {day.date}
            </div>
            {!day.hasSubmission ? (
              <p className="mb-2 text-sm italic text-[var(--text-muted)]">No submission for this day yet.</p>
            ) : null}
            <dl className="space-y-1 text-sm">
              {Object.entries(RECENT_CHANGES_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <dt className="text-[var(--text-muted)]">{label}</dt>
                  <dd className="font-medium text-[var(--text)]">
                    {formatStatValue(day.metrics?.[key], RECENT_CHANGES_FORMATS[key])}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </DashboardSection>
  );
}
