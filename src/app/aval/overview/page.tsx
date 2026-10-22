"use client";

import { StatCard, type StatCardStatus } from "@/components/dashboard/StatCard";
import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { AttributionSection } from "@/components/dashboard/AttributionSection";
import { RevenueBreakdown, addCash } from "@/components/dashboard/RevenueBreakdown";
import { OfferSplitSection } from "@/components/dashboard/OfferSplitSection";
import { SalesCycleSection } from "@/components/dashboard/SalesCycleSection";
import type { SalesCycleResponse } from "@/lib/sales-cycle";
import { MetricGroups } from "@/components/dashboard/MetricGroups";
import { HeroStat } from "@/components/dashboard/HeroStat";
import { rangePeriodLabel } from "@/lib/range-label";
import type { WebinarTotals } from "@/lib/metrics";
import { PieSplit } from "@/components/dashboard/PieSplit";
import { RateColumns } from "@/components/dashboard/RateColumns";
import { LiveCashToday } from "@/components/dashboard/LiveCashToday";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue, type StatFormat } from "@/lib/format";
import { cellStatus, type GoalDirection } from "@/lib/weekly-scorecard";
import type { GoalsConfig } from "@/lib/goals";

type MetricsResponse = {
  totalCashCollected: number | null;
  collectedPerBookedCallHT: number | null;
  cashCollectedPerOptInPaid: number | null;
  netCash: number | null;
  frontEndRoas: number | null;
  netRoas: number | null;
  processingFees: number | null;
  financingFees: number | null;
  financedCash: number | null;
  lowTicketCommission: number | null;
  highTicketCommission: number | null;
  adsActive: boolean;

  cashCollectedLowTicket: number | null;
  attributedCashLowTicket: number | null;
  cashCollectedLowTicketPaid: number | null;
  cashCollectedLowTicketOrganic: number | null;
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
  dials: number | null;
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
  softwareClosed: number | null;
  highTicketCallsPitched: number | null;
  newHighTicketCallsBooked: number | null;
  revenueHighTicket: number | null;

  cacLowTicketPaid: number | null;
  cacHighTicketPaid: number | null;
  leadToCloseRate: number | null;
  costPerCallHT: number | null;
  costPerLiveCallHT: number | null;
  avgDaysToClose: number | null;

  vslViews: number | null;
  vslPlayRate: number | null;
  vslEngagementRate: number | null;
  htVslViews: number | null;
  htVslPlayRate: number | null;
  htVslEngagementRate: number | null;
  funnelConversionRatePaid: number | null;
  funnelConversionRateOrganic: number | null;

  webinar: WebinarTotals;
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

// --- KPI helpers: same green/yellow/red scale the Weekly Scorecard uses, so
// a target set once in lib/goals.ts lights up consistently everywhere. A
// metric with no goal defined yet just shows nothing extra — never a fake
// target.
function kpiStatus(
  actual: number | null | undefined,
  goal: number | null | undefined,
  direction: GoalDirection | null,
  redAt: number | null = null,
): StatCardStatus {
  if (goal === null || goal === undefined || direction === null || actual === undefined) {
    return null;
  }
  return cellStatus(actual ?? null, goal, direction, redAt);
}

function kpiLabel(
  goal: number | null | undefined,
  direction: GoalDirection | null,
  format: StatFormat
): string | null {
  if (goal === null || goal === undefined || direction === null) return null;
  return `${direction === "higher" ? "≥" : "≤"} ${formatStatValue(goal, format)}`;
}

export default function OverviewPage() {
  const { range, setRange } = useSharedRange();
  const period = rangePeriodLabel(range);
  const { data: salesCycle } = useSectionData<SalesCycleResponse>("/api/aval/overview/sales-cycle", range);

  const { data: metrics } = useSectionData<MetricsResponse>("/api/aval/overview/metrics", range);
  const { data: leadSources } = useSectionData<LeadSourcesResponse>(
    "/api/aval/overview/lead-sources",
    range
  );
  const { data: connectionRate } = useSectionData<ConnectionRateResponse>(
    "/api/aval/overview/connection-rate",
    range
  );
  const { data: planSplit } = useSectionData<PlanSplitResponse>(
    "/api/aval/overview/plan-split",
    range
  );
  const { data: goals } = useSectionData<GoalsConfig>("/api/aval/goals", range);

  const adsActive = metrics?.adsActive ?? false;
  // Paid ROAS counts ALL paid cash: affiliate, high ticket and webinar VIP, as split on the form.
  const paidCash = addCash(
    metrics?.cashCollectedLowTicketPaid,
    metrics?.cashCollectedHighTicketPaid,
    metrics?.webinar.vipCashPaid
  );
  const paidRoas =
    paidCash !== null && metrics?.adSpend ? paidCash / metrics.adSpend : null;
  const notActive = "Not Active";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Overview</h1>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>
      <DashboardSection title="Live Cash Today">
        <LiveCashToday apiPath="/api/aval/overview/live-cash" />
      </DashboardSection>

      {/* TIER 1 — KEYSTONE METRICS as hero cards: the numbers that answer "scale or pull the brake" */}
      <DashboardSection title="Keystone Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <HeroStat
            label="Total Cash Collected"
            value={metrics?.totalCashCollected}
            format="currency"
            period={period}
            status={kpiStatus(metrics?.totalCashCollected, goals?.totalCashCollected, "higher")}
            goal={kpiLabel(goals?.totalCashCollected, "higher", "currency")}
            sub="Collected, not booked"
          />
          <HeroStat
            label="Net Cash"
            value={metrics?.netCash}
            format="currency"
            period={period}
            sub="After ad spend, commissions and fees"
          />
          <HeroStat
            label="Paid ROAS"
            value={paidRoas}
            format="ratio"
            period={period}
            override={!adsActive ? notActive : undefined}
            status={adsActive ? kpiStatus(paidRoas, goals?.roasTotal?.min, "higher") : null}
            goal={adsActive ? kpiLabel(goals?.roasTotal?.min, "higher", "ratio") : null}
            sub="Paid cash ÷ ad spend"
          />
          <HeroStat
            label="Ad Spend"
            value={metrics?.adSpend}
            format="currency"
            period={period}
            sub="Meta, from the daily form"
          />
          <HeroStat
            size="md"
            label="Front-End ROAS"
            value={metrics?.frontEndRoas}
            format="ratio"
            override={!adsActive ? notActive : undefined}
            sub="Paid cash after fees ÷ ad spend"
          />
          <HeroStat
            size="md"
            label="Net ROAS"
            value={metrics?.netRoas}
            format="ratio"
            override={!adsActive ? notActive : undefined}
            sub="After fees and commissions"
          />
          <HeroStat
            size="md"
            label="Cash / Booked Call (HT)"
            value={metrics?.collectedPerBookedCallHT}
            format="currency"
            sub="High ticket cash ÷ calls booked"
          />
          <HeroStat
            size="md"
            label="Attributed Affiliate Cash"
            value={metrics?.attributedCashLowTicket}
            format="currency"
            sub={`Portal tracked · ${formatStatValue(metrics?.cashCollectedLowTicket, "currency")} logged`}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
          <span>
            Affiliate commission this range:{" "}
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
          <span>
            Processing fees (2.5% of high ticket and VIP cash):{" "}
            <span className="font-semibold text-[var(--text)]">
              {formatStatValue(metrics?.processingFees, "currency")}
            </span>
          </span>
          <span>
            Financing fees (15% of {formatStatValue(metrics?.financedCash, "currency")} financed):{" "}
            <span className="font-semibold text-[var(--text)]">
              {formatStatValue(metrics?.financingFees, "currency")}
            </span>
          </span>
        </div>
      </DashboardSection>

      {/* TIER 2 — REVENUE BREAKDOWN */}
      <DashboardSection title="Revenue Breakdown">
        <RevenueBreakdown
          lowTicketOrganic={metrics?.cashCollectedLowTicketOrganic}
          lowTicketPaid={metrics?.cashCollectedLowTicketPaid}
          highTicketOrganic={metrics?.cashCollectedHighTicketOrganic}
          highTicketPaid={metrics?.cashCollectedHighTicketPaid}
          vipOrganic={metrics?.webinar.vipCashOrganic}
          vipPaid={metrics?.webinar.vipCashPaid}
          revenueHighTicket={metrics?.revenueHighTicket}
          adSpend={metrics?.adSpend}
        />
      </DashboardSection>

      {/* UNIT ECONOMICS: what a customer costs against what they pay, per ticket. */}
      <DashboardSection title="Unit Economics">
        <MetricGroups
          groups={[
            {
              title: "Affiliate",
              metrics: [
                {
                  label: "CAC (Paid)",
                  value: metrics?.cacLowTicketPaid,
                  format: "currency",
                  override: !adsActive ? notActive : undefined,
                  subtext: "Ad spend ÷ affiliate sales from paid.",
                  status: adsActive ? kpiStatus(metrics?.cacLowTicketPaid, goals?.cpaLowTicket?.max, "lower") : null,
                  goal: adsActive ? kpiLabel(goals?.cpaLowTicket?.max, "lower", "currency") : null,
                },
                {
                  label: "Cash Collected / Opt-In (Paid)",
                  value: metrics?.cashCollectedPerOptInPaid,
                  format: "currency",
                  subtext: "Affiliate paid cash ÷ paid opt-ins.",
                },
                {
                  label: "AOV",
                  value: metrics?.averageOrderValueLowTicket,
                  format: "currency",
                  subtext: "Affiliate cash ÷ affiliate sales.",
                },
              ],
            },
            {
              title: "High Ticket",
              metrics: [
                {
                  label: "CAC (Paid)",
                  value: metrics?.cacHighTicketPaid,
                  format: "currency",
                  subtext: "Ad spend ÷ high ticket deals closed from paid.",
                },
                {
                  label: "AOV",
                  value: metrics?.averageOrderValueHighTicket,
                  format: "currency",
                  subtext: "High ticket cash ÷ high ticket deals closed.",
                },
                {
                  label: "Cost Per Call",
                  value: metrics?.costPerCallHT,
                  format: "currency",
                  override: !adsActive ? notActive : undefined,
                  subtext: "Ad spend ÷ paid calls booked (Calendly, lead tagged paid).",
                },
                {
                  label: "Cost Per Live Call",
                  value: metrics?.costPerLiveCallHT,
                  format: "currency",
                  override: !adsActive ? notActive : undefined,
                  subtext: "Ad spend ÷ paid calls that showed. Blank until paid shows are tracked.",
                },
              ],
            },
            {
              title: "Conversion",
              metrics: [
                {
                  label: "Lead-To-Close Rate",
                  value: metrics?.leadToCloseRate,
                  format: "percent",
                  subtext: "Affiliate sales ÷ tracked leads.",
                },
                {
                  label: "Time To Close (Avg Days)",
                  value: salesCycle?.avgDays,
                  format: "number",
                  subtext: "Days from first opt-in to first close. Same as Avg Sales Cycle below.",
                },
              ],
            },
          ]}
        />
      </DashboardSection>

      {/* TIER 5 — HIGH-TICKET BACKEND */}
      <DashboardSection title="High-Ticket Backend">
        <RateColumns
          columns={[
            {
              title: "Show Rate",
              value: metrics?.highTicketShowRate,
              formula: "Calls Showed ÷ Calls Booked.",
              status: kpiStatus(metrics?.highTicketShowRate, goals?.showRate?.min, "higher"),
              goal: kpiLabel(goals?.showRate?.min, "higher", "percent"),
              inputs: [
                { label: "Calls Showed", value: metrics?.highTicketCallsShowed, note: "High Ticket Closer's EOD log." },
                { label: "Calls Booked", value: metrics?.highTicketCallsBooked, note: "High Ticket Closer's EOD log." },
              ],
            },
            {
              title: "Close Rate",
              value: metrics?.highTicketCloseRate,
              formula: "HT Deals Closed ÷ Calls Showed.",
              status: kpiStatus(metrics?.highTicketCloseRate, goals?.highTicketCloseRate?.min, "higher"),
              goal: kpiLabel(goals?.highTicketCloseRate?.min, "higher", "percent"),
              inputs: [
                { label: "Closed (HT)", value: metrics?.highTicketClosed, note: "Closed (PIF) or Payment Plan." },
                { label: "Calls Showed", value: metrics?.highTicketCallsShowed },
              ],
            },
            {
              title: "Pitch Rate",
              value: metrics?.highTicketPitchRate,
              formula: "Pitched high ticket calls ÷ software closes.",
              inputs: [
                { label: "Pitched High Ticket Calls", value: metrics?.highTicketCallsPitched, note: "Setters' Affiliate EOD." },
                { label: "Software Closes", value: metrics?.softwareClosed, note: "Setters' Affiliate EOD." },
              ],
            },
            {
              title: "Booking Rate (From Affiliate)",
              value: metrics?.highTicketBookingRateFromLowTicket,
              formula: "New HT calls booked ÷ Affiliate Sales.",
              inputs: [
                { label: "New HT Calls Booked", value: metrics?.newHighTicketCallsBooked },
                { label: "Affiliate Sales", value: metrics?.sales },
              ],
            },
          ]}
        />

        {/* Yearly / Monthly Plan Split — de-emphasized sub-section, global range now */}
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase text-[var(--text-muted)]">
            Yearly / Monthly Plan Split
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm lg:col-span-2">
              {planSplit ? (
                <PieSplit
                  unit={["close", "closes"]}
                  emptyText="No monthly or yearly plans in this range."
                  slices={[
                    { key: "monthly", label: "Monthly Plans", value: planSplit.monthly, detail: "Affiliate PCN, Plan? = Monthly." },
                    { key: "yearly", label: "Yearly Plans", value: planSplit.yearly, detail: "Affiliate PCN, Plan? = Yearly." },
                    ...(planSplit.unknown > 0
                      ? [{ key: "unknown", label: "No Plan Logged", value: planSplit.unknown, detail: "Affiliate PCN with Plan? left blank." }]
                      : []),
                  ]}
                />
              ) : (
                <p className="text-sm text-[var(--text-muted)]">Loading...</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <StatCard
                label="Yearly Share"
                value={planSplit?.yearlyShare}
                format="percent"
                size="lg"
                subtext="Yearly ÷ total PCN closes."
                status={kpiStatus(planSplit?.yearlyShare, goals?.yearlyShare?.min, "higher")}
                goal={kpiLabel(goals?.yearlyShare?.min, "higher", "percent")}
              />
              <StatCard
                label="Total Closes"
                value={planSplit?.total}
                format="number"
                size="lg"
                subtext="Monthly + Yearly + unclassified."
              />
            </div>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="Offer Split & PIF Rate">
        <OfferSplitSection apiPath="/api/aval/overview/offer-split" range={range} />
      </DashboardSection>

      <DashboardSection title="Sales Cycle">
        <SalesCycleSection apiPath="/api/aval/overview/sales-cycle" range={range} period={period} />
      </DashboardSection>

      {/* AFFILIATE (Base44): lead flow, setter funnel, funnel health, attribution. Kept together below the webinar and high ticket. */}
      <DashboardSection title="Affiliate Lead Flow">
        <MetricGroups
          groups={[
            {
              title: "Opt-Ins",
              metrics: [
                {
                  label: "Opt-Ins (Paid)",
                  value: metrics?.optInsPaid,
                  format: "number",
                  subtext: "Leads table, source = Paid.",
                  status: kpiStatus(metrics?.optInsPaid, goals?.optInsPaid, "higher"),
                  goal: kpiLabel(goals?.optInsPaid, "higher", "number"),
                },
                {
                  label: "Opt-Ins (Organic)",
                  value: metrics?.optInsOrganic,
                  format: "number",
                  subtext: "Leads table, source = Organic.",
                  status: kpiStatus(metrics?.optInsOrganic, goals?.optInsOrganic, "higher"),
                  goal: kpiLabel(goals?.optInsOrganic, "higher", "number"),
                },
              ],
            },
          ]}
        />
      </DashboardSection>

      {/* TIER 4 — FRONT-END SALES CONVERSION: the setter funnel left to right, dial to close */}
      <DashboardSection title="Affiliate Sales Conversion">
        <RateColumns
          columns={[
            {
              title: "Pickup Rate",
              value: metrics?.pickupRate,
              formula: "Pickups ÷ Dials.",
              inputs: [
                { label: "Pickups", value: metrics?.pickups, note: "Setters' Affiliate EOD." },
                { label: "Dials", value: metrics?.dials },
              ],
            },
            {
              title: "Connection Rate (Paid)",
              value: connectionRate?.paid.rate,
              formula: "Paid leads with a 1+ min call ÷ paid opt-ins.",
              status: kpiStatus(connectionRate?.paid.rate, goals?.connectionRate?.min, "higher"),
              goal: kpiLabel(goals?.connectionRate?.min, "higher", "percent"),
              inputs: [
                { label: "Connected", value: connectionRate?.paid.connected, note: connectionRate ? `Tracked since ${connectionRate.trackingStart}.` : undefined },
                { label: "Paid Opt-Ins", value: connectionRate?.paid.optIns },
              ],
            },
            {
              title: "Connection Rate (Organic)",
              value: connectionRate?.organic.rate,
              formula: "Organic leads with a 1+ min call ÷ organic opt-ins.",
              status: kpiStatus(connectionRate?.organic.rate, goals?.connectionRate?.min, "higher"),
              goal: kpiLabel(goals?.connectionRate?.min, "higher", "percent"),
              inputs: [
                { label: "Connected", value: connectionRate?.organic.connected, note: connectionRate ? `Tracked since ${connectionRate.trackingStart}.` : undefined },
                { label: "Organic Opt-Ins", value: connectionRate?.organic.optIns },
              ],
            },
            {
              title: "Pitch Rate",
              value: metrics?.pitchRate,
              formula: "Software Pitched ÷ Pickups.",
              inputs: [
                { label: "Software Pitched", value: metrics?.softwarePitched, note: "Setters' Affiliate EOD." },
                { label: "Pickups", value: metrics?.pickups },
              ],
            },
            {
              title: "Close Rate (Affiliate)",
              value: metrics?.closeRateLowTicket,
              formula: "Software Closed ÷ Software Pitched.",
              status: kpiStatus(metrics?.closeRateLowTicket, goals?.closeRateLowTicket?.min, "higher"),
              goal: kpiLabel(goals?.closeRateLowTicket?.min, "higher", "percent"),
              inputs: [
                { label: "Software Closed", value: metrics?.softwareClosed },
                { label: "Software Pitched", value: metrics?.softwarePitched },
                { label: "Affiliate Sales", value: metrics?.sales, note: "As logged on the daily metrics form." },
              ],
            },
          ]}
        />
      </DashboardSection>

      {/* TIER 7 — FUNNEL & MARKETING HEALTH (diagnostic only) */}
      <DashboardSection title="Affiliate Funnel Health & Lead Sources (Diagnostic Only)">
        <p className="mb-3 text-sm text-[var(--text-muted)]">
          Check this tier when something upstream breaks — not part of the daily glance.
        </p>
        <MetricGroups
          groups={[
            {
              title: "VSL",
              metrics: [
                {
                  label: "VSL Views",
                  value: metrics?.vslViews,
                  format: "number",
                  status: kpiStatus(metrics?.vslViews, goals?.vslViews, "higher"),
                  goal: kpiLabel(goals?.vslViews, "higher", "number"),
                },
                {
                  label: "Play Rate",
                  value: metrics?.vslPlayRate,
                  format: "percent",
                  subtext: "Plays ÷ views, from VTurb.",
                  status: kpiStatus(metrics?.vslPlayRate, goals?.vslPlayRate?.min, "higher"),
                  goal: kpiLabel(goals?.vslPlayRate?.min, "higher", "percent"),
                },
                {
                  label: "Engagement Rate",
                  value: metrics?.vslEngagementRate,
                  format: "percent",
                  subtext: "From VTurb.",
                  status: kpiStatus(metrics?.vslEngagementRate, goals?.vslEngagementRate?.min, "higher"),
                  goal: kpiLabel(goals?.vslEngagementRate?.min, "higher", "percent"),
                },
                {
                  label: "Opt-In Rate (Paid)",
                  value: metrics?.optInRate,
                  format: "percent",
                  subtext: "Paid leads ÷ VSL views (the form's value when typed).",
                  status: kpiStatus(metrics?.optInRate, goals?.optInRate?.min, "higher", goals?.optInRate?.redBelow ?? null),
                  goal: [kpiLabel(goals?.optInRate?.min, "higher", "percent"), goals?.optInRate?.redBelow != null ? `under ${formatStatValue(goals.optInRate.redBelow, "percent")} is bad` : null].filter(Boolean).join(", ") || null,
                },
              ],
            },
            {
              title: "High Ticket VSL",
              metrics: [
                {
                  label: "VSL Views",
                  value: metrics?.htVslViews,
                  format: "number",
                  subtext: "The /apply VSL, from VTurb.",
                },
                {
                  label: "Play Rate",
                  value: metrics?.htVslPlayRate,
                  format: "percent",
                  subtext: "Plays ÷ views, from VTurb.",
                },
                {
                  label: "Engagement Rate",
                  value: metrics?.htVslEngagementRate,
                  format: "percent",
                  subtext: "From VTurb.",
                },
              ],
            },
            {
              title: "Funnel Conversion",
              metrics: [
                {
                  label: "Paid",
                  value: metrics?.funnelConversionRatePaid,
                  format: "percent",
                  subtext: "Affiliate sales from paid ÷ paid opt-ins.",
                  status: kpiStatus(metrics?.funnelConversionRatePaid, goals?.funnelConversionRate?.min, "higher"),
                  goal: kpiLabel(goals?.funnelConversionRate?.min, "higher", "percent"),
                },
                {
                  label: "Organic",
                  value: metrics?.funnelConversionRateOrganic,
                  format: "percent",
                  subtext: "Affiliate sales from organic ÷ organic opt-ins.",
                  status: kpiStatus(metrics?.funnelConversionRateOrganic, goals?.funnelConversionRate?.min, "higher"),
                  goal: kpiLabel(goals?.funnelConversionRate?.min, "higher", "percent"),
                },
              ],
            },
            {
              title: "Lead Sources",
              metrics: [
                {
                  label: "Paid Leads (Tracked)",
                  value: leadSources?.paidLeadsTracked,
                  format: "number",
                  subtext: "Leads table, source = Paid.",
                },
                {
                  label: "Organic Leads (Tracked)",
                  value: leadSources?.organicLeadsTracked,
                  format: "number",
                  subtext: "Leads table, source = Organic.",
                },
              ],
            },
          ]}
        />
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

      <DashboardSection title="Affiliate Attribution (Base 44)">
        <AttributionSection
          apiPath="/api/aval/overview/attribution"
          byRepPath="/api/aval/overview/attribution/by-rep"
          brandLabel="Base 44"
          theme="deepspace"
          goal={goals?.attributionRate?.min}
        />
      </DashboardSection>

      <DashboardSection title="Refund / Chargeback">
        <MetricGroups
          groups={[
            {
              title: "Rate",
              metrics: [
                {
                  label: "Refund / Chargeback Rate",
                  value: metrics ? (metrics.refundChargebackRate ?? 0) : undefined,
                  format: "percent",
                  subtext: "(Refund $ + chargeback $) ÷ total cash collected.",
                },
              ],
            },
            {
              title: "Refunds",
              metrics: [
                { label: "Count", value: metrics ? (metrics.refundCount ?? 0) : undefined, format: "number" },
                { label: "Dollars", value: metrics ? (metrics.refundDollars ?? 0) : undefined, format: "currency" },
              ],
            },
            {
              title: "Chargebacks",
              metrics: [
                { label: "Count", value: metrics ? (metrics.chargebackCount ?? 0) : undefined, format: "number" },
                { label: "Dollars", value: metrics ? (metrics.chargebackDollars ?? 0) : undefined, format: "currency" },
              ],
            },
          ]}
        />
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          {metrics && !metrics.refundCount && !metrics.chargebackCount && !metrics.refundChargebackDollars
            ? "No refunds or chargebacks logged in this range. "
            : ""}
          From the Refunds table in Airtable.
        </p>
      </DashboardSection>
    </div>
  );
}
