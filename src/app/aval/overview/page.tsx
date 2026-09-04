"use client";

import { useState } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardGrid, DashboardSection } from "@/components/dashboard/StatCardGrid";
import { AttributionSection } from "@/components/dashboard/AttributionSection";
import {
  RangeFilterBar,
  defaultRangeState,
  type RangeState,
} from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue, type StatFormat } from "@/lib/format";
import { WeeklyScorecard } from "./WeeklyScorecard";

type MetricsResponse = {
  sales: number | null;
  adSpend: number | null;
  totalCashCollected: number | null;
  cashCollectedLowTicket: number | null;
  salesLowTicketPaid: number | null;
  salesLowTicketOrganic: number | null;
  cashLowTicketPaid: number | null;
  cashLowTicketOrganic: number | null;
  cashHighTicketPaid: number | null;
  cashHighTicketOrganic: number | null;
  dials: number | null;
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
  totalLeadsTracked: number;
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
  form: {
    salesLtPaid: number | null;
    salesLtOrganic: number | null;
    cashLtPaid: number | null;
    cashLtOrganic: number | null;
    cashHtPaid: number | null;
    cashHtOrganic: number | null;
  };
};

type PlanSplitResponse = {
  monthly: number;
  yearly: number;
  unknown: number;
  total: number;
  yearlyShare: number | null;
};


type RecentChangesResponse = {
  days: {
    date: string;
    changesMadeToday: string;
    metrics: Record<string, number | null>;
  }[];
};

const RECENT_CHANGES_LABELS: Record<string, string> = {
  adSpend: "Ad Spend",
  costPerLead: "Cost / Lead",
  landingPageConnectRate: "LP Connect Rate",
  vslViews: "VSL Views",
  vslPlayRate: "VSL Play Rate (Paid)",
  vslEngagementRate: "VSL Engagement (Paid)",
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
  landingPageConnectRate: "percent",
  vslViews: "number",
  vslPlayRate: "percent",
  vslEngagementRate: "percent",
  dials: "number",
  connectionRate: "percent",
  sales: "number",
  cashCollected: "currency",
  closeRate: "percent",
  funnelConversionRate: "percent",
};

export default function OverviewPage() {
  const { range, setRange } = useSharedRange();

  const [leadSourcesRange, setLeadSourcesRange] = useState<RangeState>(
    defaultRangeState("last_7_days")
  );
  const [planRange, setPlanRange] = useState<RangeState>(defaultRangeState("last_7_days"));

  const { data: metrics } = useSectionData<MetricsResponse>("/api/aval/overview/metrics", range);
  const { data: leadSources } = useSectionData<LeadSourcesResponse>(
    "/api/aval/overview/lead-sources",
    leadSourcesRange
  );
  const { data: planSplit } = useSectionData<PlanSplitResponse>(
    "/api/aval/overview/plan-split",
    planRange
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
          <StatCard label="Dials" value={metrics?.dials} format="number" subtext="From Affiliate EOD" />
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

      <DashboardSection title="Paid vs Organic (Marketing Form)">
        <StatCardGrid>
          <StatCard label="Sales LT — Paid" value={metrics?.salesLowTicketPaid} format="number" />
          <StatCard label="Sales LT — Organic" value={metrics?.salesLowTicketOrganic} format="number" />
          <StatCard label="Cash LT — Paid" value={metrics?.cashLowTicketPaid} format="currency" />
          <StatCard label="Cash LT — Organic" value={metrics?.cashLowTicketOrganic} format="currency" />
          <StatCard label="Cash HT — Paid" value={metrics?.cashHighTicketPaid} format="currency" />
          <StatCard label="Cash HT — Organic" value={metrics?.cashHighTicketOrganic} format="currency" />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="Attribution — Base 44">
        <AttributionSection
          apiPath="/api/aval/overview/attribution"
          brandLabel="Base 44"
          theme="deepspace"
        />
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
          <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-sm text-[var(--text-muted)] backdrop-blur-sm">
            No monthly or yearly plans in this range.
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        title="Lead Sources"
        action={<RangeFilterBar value={leadSourcesRange} onChange={setLeadSourcesRange} />}
      >
        <StatCardGrid>
          <StatCard
            label="Total Leads (Tracked)"
            value={leadSources?.totalLeadsTracked}
            format="number"
            subtext="Paid + Organic tracked leads"
          />
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

        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            As reported on the Marketing Daily Metrics form
          </div>
          <StatCardGrid>
            <StatCard label="Sales LT — Paid" value={leadSources?.form.salesLtPaid} format="number" />
            <StatCard label="Sales LT — Organic" value={leadSources?.form.salesLtOrganic} format="number" />
            <StatCard label="Cash LT — Paid" value={leadSources?.form.cashLtPaid} format="currency" />
            <StatCard label="Cash LT — Organic" value={leadSources?.form.cashLtOrganic} format="currency" />
            <StatCard label="Cash HT — Paid" value={leadSources?.form.cashHtPaid} format="currency" />
            <StatCard label="Cash HT — Organic" value={leadSources?.form.cashHtOrganic} format="currency" />
          </StatCardGrid>
        </div>
      </DashboardSection>

      <RecentChanges />

      <WeeklyScorecard />
    </div>
  );
}

function RecentChanges() {
  const { data } = useSectionData<RecentChangesResponse>(
    "/api/aval/overview/recent-changes",
    defaultRangeState("all_time")
  );

  return (
    <DashboardSection title="Recent Changes">
      <p className="mb-3 text-sm text-[var(--text-muted)]">
        Each &quot;Changes Made Today&quot; note from the Marketing Daily Metrics form, with
        that day&apos;s funnel numbers next to it so you can see how the change landed.
      </p>
      {data && data.days.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.days.map((day) => (
            <div
              key={day.date}
              className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm"
            >
              <div className="mb-2 text-xs font-semibold uppercase text-[var(--text-muted)]">
                {day.date}
              </div>
              <p className="mb-3 whitespace-pre-wrap border-l-2 border-[var(--accent)] pl-3 text-sm text-[var(--text-strong)]">
                {day.changesMadeToday}
              </p>
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
      ) : (
        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-sm text-[var(--text-muted)] backdrop-blur-sm">
          No &quot;Changes Made Today&quot; notes logged in the last 14 days.
        </div>
      )}
    </DashboardSection>
  );
}
