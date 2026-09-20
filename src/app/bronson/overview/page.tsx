"use client";

import { StatCard, type StatCardStatus } from "@/components/dashboard/StatCard";
import { StatCardGrid, DashboardSection } from "@/components/dashboard/StatCardGrid";
import { AttributionSection } from "@/components/dashboard/AttributionSection";
import { CashCalendar } from "@/components/dashboard/CashCalendar";
import { RangeFilterBar, defaultRangeState } from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue, type StatFormat } from "@/lib/format";
import { cellStatus, type GoalDirection } from "@/lib/weekly-scorecard";
import type { GoalsConfig } from "@/lib/goals";
import { WeeklyScorecard } from "./WeeklyScorecard";

type MetricsResponse = {
  totalCashCollected: number | null;
  collectedPerBookedCallHT: number | null;
  cashCollectedPerOptInPaid: number | null;
  netCash: number | null;
  lowTicketCommission: number | null;
  highTicketCommission: number | null;
  adsActive: boolean;

  cashCollectedLowTicket: number | null;
  cashCollectedHighTicket: number | null;
  cashCollectedHighTicketPaid: number | null;
  cashCollectedHighTicketOrganic: number | null;
  adSpend: number | null;

  optInsPaid: number | null;
  optInsOrganic: number | null;
  landingPageConnectRate: number | null;
  optInRate: number | null;
  costPerLeadPaid: number | null;

  pickups: number | null;
  pickupRate: number | null;
  softwarePitched: number | null;
  pitchRate: number | null;
  sales: number | null;
  averageOrderValueLowTicket: number | null;
  averageOrderValueHighTicket: number | null;
  closeRateLowTicket: number | null;
  connectionRate: number | null;

  highTicketCallsBooked: number | null;
  highTicketCallsShowed: number | null;
  highTicketShowRate: number | null;
  highTicketPitched: number | null;
  highTicketClosed: number | null;
  highTicketCloseRate: number | null;
  highTicketBookingRateFromLowTicket: number | null;
  highTicketPitchRate: number | null;
  revenueHighTicket: number | null;

  cacLowTicketPaid: number | null;
  cacHighTicketPaid: number | null;
  leadToCloseRate: number | null;
  costPerCallHT: number | null;
  avgDaysToClose: number | null;

  vslViews: number | null;
  vslPlayRate: number | null;
  vslEngagementRate: number | null;
  funnelConversionRatePaid: number | null;
  funnelConversionRateOrganic: number | null;

  refundCount: number | null;
  refundDollars: number | null;
  chargebackCount: number | null;
  chargebackDollars: number | null;
  refundChargebackDollars: number | null;
  refundChargebackRate: number | null;
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
  pcn: {
    totalLogged: number;
    matchedToLead: number;
    paidClosed: number;
    organicClosed: number;
  };
};

type ConnectionRateResponse = {
  trackingStart: string;
  paid: { optIns: number; connected: number; rate: number | null };
  organic: { optIns: number; connected: number; rate: number | null };
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
  }[];
};

// --- KPI helpers: same green/yellow/red scale the Weekly Scorecard uses, so
// a target set once in lib/goals.ts lights up consistently everywhere. A
// metric with no goal defined yet just shows nothing extra — never a fake
// target.
function kpiStatus(
  actual: number | null | undefined,
  goal: number | null | undefined,
  direction: GoalDirection | null
): StatCardStatus {
  if (goal === null || goal === undefined || direction === null || actual === undefined) {
    return null;
  }
  return cellStatus(actual ?? null, goal, direction);
}

function kpiLabel(
  goal: number | null | undefined,
  direction: GoalDirection | null,
  format: StatFormat
): string | null {
  if (goal === null || goal === undefined || direction === null) return null;
  return `${direction === "higher" ? "≥" : "≤"} ${formatStatValue(goal, format)}`;
}

function connectionSubtext(
  data: ConnectionRateResponse | undefined,
  source: "paid" | "organic",
  tag: string
): string {
  const base = `Leads tagged "${tag}" with a 1+ min call ÷ ${source === "paid" ? "paid" : "organic"} opt-ins.`;
  if (!data) return base;
  const { connected, optIns } = data[source];
  return `${connected} of ${optIns} opt-ins. ${base} Tracked since ${data.trackingStart}.`;
}

export default function OverviewPage() {
  const { range, setRange } = useSharedRange();

  const { data: metrics } = useSectionData<MetricsResponse>("/api/bronson/overview/metrics", range);
  const { data: leadSources } = useSectionData<LeadSourcesResponse>(
    "/api/bronson/overview/lead-sources",
    range
  );
  const { data: connectionRate } = useSectionData<ConnectionRateResponse>(
    "/api/bronson/overview/connection-rate",
    range
  );
  const { data: planSplit } = useSectionData<PlanSplitResponse>(
    "/api/bronson/overview/plan-split",
    range
  );
  const { data: goals } = useSectionData<GoalsConfig>("/api/bronson/goals", range);

  const adsActive = metrics?.adsActive ?? false;
  const notActive = "Not Active";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Overview</h1>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>

      {/* TIER 1 — KEYSTONE METRICS: the four numbers that answer "scale or pull the brake" */}
      <DashboardSection title="Keystone Metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Cash Collected"
            value={metrics?.totalCashCollected}
            format="currency"
            size="lg"
            subtext="Cash actually collected, not revenue booked — payment plans that never fully collect don't count here."
            status={kpiStatus(metrics?.totalCashCollected, goals?.totalCashCollected, "higher")}
            goal={kpiLabel(goals?.totalCashCollected, "higher", "currency")}
          />
          <StatCard
            label="Collected $ / Booked Call (HT)"
            value={metrics?.collectedPerBookedCallHT}
            format="currency"
            size="lg"
            subtext="Cash Collected (HT) ÷ Calls Booked. One number for show rate, close rate, price, and collections combined — climbing means scale, dropping means diagnose."
          />
          <StatCard
            label="Cash Collected / Opt-In (Paid)"
            value={metrics?.cashCollectedPerOptInPaid}
            format="currency"
            size="lg"
            subtext="Front-end keystone: Cash Collected — Low Ticket (Paid) ÷ Paid Opt-Ins."
          />
          <StatCard
            label="Net Cash"
            value={metrics?.netCash}
            format="currency"
            size="lg"
            subtext="Cash Collected − Ad Spend − commissions (10%/20% weekday/weekend on Low Ticket, flat 15% on High Ticket)."
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
          <span>
            Low Ticket commission this range:{" "}
            <span className="font-semibold text-[var(--text)]">
              {formatStatValue(metrics?.lowTicketCommission, "currency")}
            </span>
          </span>
          <span>
            High Ticket commission this range:{" "}
            <span className="font-semibold text-[var(--text)]">
              {formatStatValue(metrics?.highTicketCommission, "currency")}
            </span>
          </span>
        </div>
      </DashboardSection>

      {/* TIER 2 — REVENUE BREAKDOWN */}
      <DashboardSection title="Revenue Breakdown">
        <StatCardGrid>
          <StatCard
            label="Cash Collected — Low Ticket"
            value={metrics?.cashCollectedLowTicket}
            format="currency"
            subtext="Software front-end cash collected."
          />
          <StatCard
            label="Cash Collected — High Ticket"
            value={metrics?.cashCollectedHighTicket}
            format="currency"
            subtext="Real closer cash, preferred over the form-typed value."
          />
          <StatCard
            label="Revenue — High Ticket"
            value={metrics?.revenueHighTicket}
            format="currency"
            subtext="Booked revenue including payment plans not yet fully collected — reference only, Cash Collected HT is the real number."
          />
          <StatCard
            label="Cash Collected — High Ticket (Paid)"
            value={metrics?.cashCollectedHighTicketPaid}
            format="currency"
            subtext="From the Marketing Daily Metrics form."
          />
          <StatCard
            label="Cash Collected — High Ticket (Organic)"
            value={metrics?.cashCollectedHighTicketOrganic}
            format="currency"
            subtext="From the Marketing Daily Metrics form."
          />
          <StatCard
            label="Cash Collected — Paid"
            value={leadSources?.cashCollectedPaid}
            format="currency"
            subtext="Closes matched to a Paid-source lead by email, plus any lead's own Cash Collected value."
          />
          <StatCard
            label="Cash Collected — Organic"
            value={leadSources?.cashCollectedOrganic}
            format="currency"
            subtext="Closes matched to an Organic-source lead by email, plus any lead's own Cash Collected value."
          />
          <StatCard
            label="Ad Spend"
            value={metrics?.adSpend}
            format="currency"
            subtext="From Marketing Daily Metrics (Ad Spend Meta). $0.00 here is a real number — it means no paid spend ran in this range."
          />
          <StatCard
            label="Paid ROAS"
            value={leadSources?.paidRoas}
            format="ratio"
            override={!adsActive ? notActive : undefined}
            subtext="Cash Collected (Paid) ÷ Ad Spend."
            status={adsActive ? kpiStatus(leadSources?.paidRoas, goals?.roasTotal?.min, "higher") : null}
            goal={adsActive ? kpiLabel(goals?.roasTotal?.min, "higher", "ratio") : null}
          />
        </StatCardGrid>
      </DashboardSection>

      {/* TIER 3 — ACQUISITION & LEAD FLOW */}
      <DashboardSection title="Acquisition & Lead Flow">
        <StatCardGrid>
          <StatCard
            label="Opt-Ins (Paid)"
            value={metrics?.optInsPaid}
            format="number"
            subtext="Real count from the Leads table, source = Paid."
            status={kpiStatus(metrics?.optInsPaid, goals?.optInsPaid, "higher")}
            goal={kpiLabel(goals?.optInsPaid, "higher", "number")}
          />
          <StatCard
            label="Opt-Ins (Organic)"
            value={metrics?.optInsOrganic}
            format="number"
            subtext="Real count from the Leads table, source = Organic."
            status={kpiStatus(metrics?.optInsOrganic, goals?.optInsOrganic, "higher")}
            goal={kpiLabel(goals?.optInsOrganic, "higher", "number")}
          />
          <StatCard
            label="Cost Per Lead (Paid)"
            value={metrics?.costPerLeadPaid}
            format="currency"
            override={!adsActive ? notActive : undefined}
            subtext="Straight from the Marketing Daily Metrics form — no calculation needed."
            status={adsActive ? kpiStatus(metrics?.costPerLeadPaid, goals?.costPerLeadMeta?.max, "lower") : null}
            goal={adsActive ? kpiLabel(goals?.costPerLeadMeta?.max, "lower", "currency") : null}
          />
          <StatCard
            label="Landing Page Connect Rate"
            value={metrics?.landingPageConnectRate}
            format="percent"
            subtext="From the Marketing Daily Metrics form, averaged across days in range."
            status={kpiStatus(metrics?.landingPageConnectRate, goals?.landingPageConnectRate?.min, "higher")}
            goal={kpiLabel(goals?.landingPageConnectRate?.min, "higher", "percent")}
          />
          <StatCard
            label="Opt-In Rate (Paid)"
            value={metrics?.optInRate}
            format="percent"
            subtext="Opt-ins ÷ landing page views, from the form."
            status={kpiStatus(metrics?.optInRate, goals?.optInRate?.min, "higher")}
            goal={kpiLabel(goals?.optInRate?.min, "higher", "percent")}
          />
        </StatCardGrid>
      </DashboardSection>

      {/* TIER 4 — FRONT-END SALES CONVERSION */}
      <DashboardSection title="Front-End Sales Conversion">
        <StatCardGrid>
          <StatCard label="Pickups" value={metrics?.pickups} format="number" subtext="Affiliate EOD, summed across setters." />
          <StatCard
            label="Pickup Rate"
            value={metrics?.pickupRate}
            format="percent"
            subtext="Pickups ÷ Dials."
          />
          <StatCard
            label="Software Pitched"
            value={metrics?.softwarePitched}
            format="number"
            subtext="Low-ticket software pitches, from Affiliate EOD."
          />
          <StatCard
            label="Pitch Rate"
            value={metrics?.pitchRate}
            format="percent"
            subtext="Software Pitched ÷ Pickups."
          />
          <StatCard
            label="Sales — Low Ticket"
            value={metrics?.sales}
            format="number"
            subtext="From Marketing Daily Metrics."
            status={kpiStatus(metrics?.sales, goals?.salesLowTicket, "higher")}
            goal={kpiLabel(goals?.salesLowTicket, "higher", "number")}
          />
          <StatCard
            label="Close Rate — Low Ticket"
            value={metrics?.closeRateLowTicket}
            format="percent"
            subtext="Software Closed ÷ Software Pitched."
            status={kpiStatus(metrics?.closeRateLowTicket, goals?.closeRateLowTicket?.min, "higher")}
            goal={kpiLabel(goals?.closeRateLowTicket?.min, "higher", "percent")}
          />
          <StatCard
            label="AOV — Low Ticket"
            value={metrics?.averageOrderValueLowTicket}
            format="currency"
            subtext="Cash Collected — Low Ticket ÷ Sales."
          />
          <StatCard
            label="AOV — High Ticket"
            value={metrics?.averageOrderValueHighTicket}
            format="currency"
            subtext="Cash Collected — High Ticket ÷ HT Deals Closed."
          />
          <StatCard
            label="Connection Rate"
            value={metrics?.connectionRate}
            format="percent"
            subtext="Pickups ÷ Opt-Ins."
            status={kpiStatus(metrics?.connectionRate, goals?.connectionRate?.min, "higher")}
            goal={kpiLabel(goals?.connectionRate?.min, "higher", "percent")}
          />
          <StatCard
            label="Connection Rate (Paid)"
            value={connectionRate?.paid.rate}
            format="percent"
            subtext={connectionSubtext(connectionRate, "paid", "Base44 Paid")}
          />
          <StatCard
            label="Connection Rate (Organic)"
            value={connectionRate?.organic.rate}
            format="percent"
            subtext={connectionSubtext(connectionRate, "organic", "Base44 Organic")}
          />
        </StatCardGrid>
      </DashboardSection>

      {/* TIER 5 — HIGH-TICKET BACKEND */}
      <DashboardSection title="High-Ticket Backend">
        <StatCardGrid>
          <StatCard
            label="Calls Booked"
            value={metrics?.highTicketCallsBooked}
            format="number"
            subtext="From the High Ticket Closer's EOD log."
          />
          <StatCard
            label="Calls Showed"
            value={metrics?.highTicketCallsShowed}
            format="number"
            subtext="From the High Ticket Closer's EOD log."
          />
          <StatCard
            label="Show Rate"
            value={metrics?.highTicketShowRate}
            format="percent"
            subtext="Calls Showed ÷ Calls Booked."
            status={kpiStatus(metrics?.highTicketShowRate, goals?.showRate?.min, "higher")}
            goal={kpiLabel(goals?.showRate?.min, "higher", "percent")}
          />
          <StatCard
            label="Pitched (HT)"
            value={metrics?.highTicketPitched}
            format="number"
            subtext="From Post Call Note — a mid-tier or flagship offer pitched."
          />
          <StatCard
            label="Closed (HT)"
            value={metrics?.highTicketClosed}
            format="number"
            subtext="From Post Call Note — outcome Closed (PIF) or Payment Plan."
          />
          <StatCard
            label="Close Rate (HT)"
            value={metrics?.highTicketCloseRate}
            format="percent"
            subtext="Classic tracking: HT Deals Closed ÷ Calls Showed."
            status={kpiStatus(metrics?.highTicketCloseRate, goals?.highTicketCloseRate?.min, "higher")}
            goal={kpiLabel(goals?.highTicketCloseRate?.min, "higher", "percent")}
          />
          <StatCard
            label="High Ticket Pitch Rate"
            value={metrics?.highTicketPitchRate}
            format="percent"
            subtext="HT Pitched ÷ Low-Ticket Sales — the upsell-into-HT rate."
          />
          <StatCard
            label="HT Booking Rate (from LT)"
            value={metrics?.highTicketBookingRateFromLowTicket}
            format="percent"
            subtext="New HT calls booked today ÷ Low-Ticket Sales."
          />
        </StatCardGrid>

        {/* Yearly / Monthly Plan Split — de-emphasized sub-section, global range now */}
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase text-[var(--text-muted)]">
            Yearly / Monthly Plan Split
          </div>
          {planSplit && planSplit.total > 0 ? (
            <StatCardGrid>
              <StatCard label="Monthly Plans" value={planSplit.monthly} format="number" subtext="Affiliate PCN, Plan? = Monthly." />
              <StatCard label="Yearly Plans" value={planSplit.yearly} format="number" subtext="Affiliate PCN, Plan? = Yearly." />
              <StatCard label="Total Closes" value={planSplit.total} format="number" subtext="Monthly + Yearly + unclassified." />
              <StatCard
                label="Yearly Share"
                value={planSplit.yearlyShare}
                format="percent"
                subtext="Yearly ÷ total PCN closes."
              />
            </StatCardGrid>
          ) : (
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-sm text-[var(--text-muted)] backdrop-blur-sm">
              No monthly or yearly plans in this range.
            </div>
          )}
        </div>
      </DashboardSection>

      {/* TIER 6 — UNIT ECONOMICS */}
      <DashboardSection title="Unit Economics">
        <StatCardGrid>
          <StatCard
            label="CAC — Low Ticket (Paid)"
            value={metrics?.cacLowTicketPaid}
            format="currency"
            override={!adsActive ? notActive : undefined}
            subtext="Ad Spend ÷ Low-Ticket Sales (Paid). Organic isn't shown — CAC is inherently a paid-acquisition metric."
            status={adsActive ? kpiStatus(metrics?.cacLowTicketPaid, goals?.cpaLowTicket?.max, "lower") : null}
            goal={adsActive ? kpiLabel(goals?.cpaLowTicket?.max, "lower", "currency") : null}
          />
          <StatCard
            label="CAC — High Ticket (Paid)"
            value={metrics?.cacHighTicketPaid}
            format="currency"
            subtext="Ad Spend ÷ High Ticket Deals Closed (Paid)."
          />
          <StatCard
            label="Cost Per Call (HT)"
            value={metrics?.costPerCallHT}
            format="currency"
            override={!adsActive ? notActive : undefined}
            subtext="Ad Spend ÷ HT Calls Booked — efficiency of booking a call, before you even look at close rate."
          />
          <StatCard
            label="Lead-to-Close Rate"
            value={metrics?.leadToCloseRate}
            format="percent"
            subtext="Low-ticket sales ÷ tracked leads."
          />
          <StatCard
            label="Time to Close (avg)"
            value={metrics?.avgDaysToClose}
            format="number"
            subtext="Average days from opt-in to the call that collected their cash (Affiliate PCN closes only). Stretching out means cash flow is tighter than it looks."
          />
          <StatCard
            label="Cash Collected / Opt-In (Paid)"
            value={metrics?.cashCollectedPerOptInPaid}
            format="currency"
            subtext="Reference — also shown as a Tier 1 keystone above."
          />
        </StatCardGrid>
      </DashboardSection>

      {/* TIER 7 — FUNNEL & MARKETING HEALTH (diagnostic only) */}
      <DashboardSection title="Funnel & Marketing Health — Diagnostic Only">
        <p className="mb-3 text-sm text-[var(--text-muted)]">
          Check this tier when something upstream breaks — not part of the daily glance.
        </p>
        <StatCardGrid>
          <StatCard
            label="VSL Views"
            value={metrics?.vslViews}
            format="number"
            status={kpiStatus(metrics?.vslViews, goals?.vslViews, "higher")}
            goal={kpiLabel(goals?.vslViews, "higher", "number")}
          />
          <StatCard
            label="VSL Play Rate (Paid)"
            value={metrics?.vslPlayRate}
            format="percent"
            status={kpiStatus(metrics?.vslPlayRate, goals?.vslPlayRate?.min, "higher")}
            goal={kpiLabel(goals?.vslPlayRate?.min, "higher", "percent")}
          />
          <StatCard
            label="VSL Engagement Rate (Paid)"
            value={metrics?.vslEngagementRate}
            format="percent"
            status={kpiStatus(metrics?.vslEngagementRate, goals?.vslEngagementRate?.min, "higher")}
            goal={kpiLabel(goals?.vslEngagementRate?.min, "higher", "percent")}
          />
          <StatCard
            label="Funnel Conversion Rate (Paid)"
            value={metrics?.funnelConversionRatePaid}
            format="percent"
            status={kpiStatus(metrics?.funnelConversionRatePaid, goals?.funnelConversionRate?.min, "higher")}
            goal={kpiLabel(goals?.funnelConversionRate?.min, "higher", "percent")}
          />
          <StatCard
            label="Funnel Conversion Rate (Organic)"
            value={metrics?.funnelConversionRateOrganic}
            format="percent"
            status={kpiStatus(metrics?.funnelConversionRateOrganic, goals?.funnelConversionRate?.min, "higher")}
            goal={kpiLabel(goals?.funnelConversionRate?.min, "higher", "percent")}
          />
        </StatCardGrid>
      </DashboardSection>

      {/* Lead Sources detail — attribution detail lives here */}
      <DashboardSection title="Lead Sources — Attribution Detail">
        <StatCardGrid>
          <StatCard label="Paid Leads (Tracked)" value={leadSources?.paidLeadsTracked} format="number" />
          <StatCard label="Organic Leads (Tracked)" value={leadSources?.organicLeadsTracked} format="number" />
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
              {leadSources.unattributedCount === 1 ? "call" : "calls"}{" "}
              couldn&apos;t be matched to a lead email, so it&apos;s not counted above as Paid or
              Organic.
            </p>
          ) : null}
        </div>
      </DashboardSection>

      <DashboardSection title="Attribution — Base 44 + Wix">
        <AttributionSection
          apiPath="/api/bronson/overview/attribution"
          brandLabel="Base 44 + Wix"
          theme="deepspace"
        />
      </DashboardSection>

      <DashboardSection title="Refund / Chargeback">
        <StatCardGrid>
          <StatCard
            label="Refund / Chargeback Rate"
            value={metrics?.refundChargebackRate}
            format="percent"
            subtext="(Refund $ + Chargeback $) ÷ Total Cash Collected. Protects against the illusion of healthy cash collected."
          />
          <StatCard label="Refund Count" value={metrics?.refundCount} format="number" />
          <StatCard label="Refund Dollars" value={metrics?.refundDollars} format="currency" />
          <StatCard label="Chargeback Count" value={metrics?.chargebackCount} format="number" />
          <StatCard label="Chargeback Dollars" value={metrics?.chargebackDollars} format="currency" />
        </StatCardGrid>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          From the Marketing Daily Metrics form — tracked starting 2026-09, so ranges before that
          will show no data.
        </p>
      </DashboardSection>

      <RecentChanges />

      <WeeklyScorecard />

      <DashboardSection title="Cash Calendar">
        <CashCalendar apiPath="/api/bronson/overview/cash-calendar" />
      </DashboardSection>
    </div>
  );
}

function RecentChanges() {
  const { data } = useSectionData<RecentChangesResponse>(
    "/api/bronson/overview/recent-changes",
    defaultRangeState("all_time")
  );

  return (
    <DashboardSection title="Recent Changes">
      <p className="mb-3 text-sm text-[var(--text-muted)]">
        Each &quot;Changes Made Today&quot; note from the Marketing Daily Metrics form.
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
              <p className="whitespace-pre-wrap border-l-2 border-[var(--accent)] pl-3 text-sm text-[var(--text-strong)]">
                {day.changesMadeToday}
              </p>
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
