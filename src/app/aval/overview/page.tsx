"use client";

import { StatCard, type StatCardStatus } from "@/components/dashboard/StatCard";
import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { AttributionSection } from "@/components/dashboard/AttributionSection";
import { RevenueBreakdown, addCash } from "@/components/dashboard/RevenueBreakdown";
import { OfferSplitSection } from "@/components/dashboard/OfferSplitSection";
import { MetricGroups } from "@/components/dashboard/MetricGroups";
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

export default function OverviewPage() {
  const { range, setRange } = useSharedRange();

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
  // Paid ROAS counts ALL paid cash: low ticket and high ticket, as split on the form.
  const paidCash = addCash(metrics?.cashCollectedLowTicketPaid, metrics?.cashCollectedHighTicketPaid);
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

      {/* TIER 1 — KEYSTONE METRICS, grouped Cash | ROAS | Efficiency: the numbers that answer "scale or pull the brake" */}
      <DashboardSection title="Keystone Metrics">
        <MetricGroups
          groups={[
            {
              title: "Cash",
              metrics: [
                {
                  label: "Total Cash Collected",
                  value: metrics?.totalCashCollected,
                  format: "currency",
                  subtext: "Cash actually collected, not revenue booked.",
                  status: kpiStatus(metrics?.totalCashCollected, goals?.totalCashCollected, "higher"),
                  goal: kpiLabel(goals?.totalCashCollected, "higher", "currency"),
                },
                {
                  label: "Ad Spend",
                  value: metrics?.adSpend,
                  format: "currency",
                  subtext: "Meta ad spend from the daily metrics form.",
                },
                {
                  label: "Net Cash",
                  value: metrics?.netCash,
                  format: "currency",
                  subtext: "Cash − ad spend − commissions − processing and financing fees.",
                },
              ],
            },
            {
              title: "ROAS",
              metrics: [
                {
                  label: "Paid ROAS",
                  value: paidRoas,
                  format: "ratio",
                  override: !adsActive ? notActive : undefined,
                  subtext: "Paid cash (low + high ticket) ÷ ad spend.",
                  status: adsActive ? kpiStatus(paidRoas, goals?.roasTotal?.min, "higher") : null,
                  goal: adsActive ? kpiLabel(goals?.roasTotal?.min, "higher", "ratio") : null,
                },
                {
                  label: "Front-End ROAS",
                  value: metrics?.frontEndRoas,
                  format: "ratio",
                  override: !adsActive ? notActive : undefined,
                  subtext: "Paid cash after processing and financing fees ÷ ad spend.",
                },
                {
                  label: "Net ROAS",
                  value: metrics?.netRoas,
                  format: "ratio",
                  override: !adsActive ? notActive : undefined,
                  subtext: "After all expenses: fees and sales team commissions.",
                },
              ],
            },
            {
              title: "Efficiency",
              metrics: [
                {
                  label: "Collected $ / Booked Call (HT)",
                  value: metrics?.collectedPerBookedCallHT,
                  format: "currency",
                  subtext: "High ticket cash ÷ calls booked. Show rate, close rate, price and collections in one number.",
                },
                {
                  label: "Cash Collected / Opt-In (Paid)",
                  value: metrics?.cashCollectedPerOptInPaid,
                  format: "currency",
                  subtext: "Low ticket paid cash ÷ paid opt-ins.",
                },
              ],
            },
          ]}
        />
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
          <span>
            Processing fees (3% of high ticket cash):{" "}
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

      {/* UNIT ECONOMICS: what a customer costs against what they pay, per ticket. Kept right under the keystones. */}
      <DashboardSection title="Unit Economics">
        <MetricGroups
          groups={[
            {
              title: "Low Ticket",
              metrics: [
                {
                  label: "CAC (Paid)",
                  value: metrics?.cacLowTicketPaid,
                  format: "currency",
                  override: !adsActive ? notActive : undefined,
                  subtext: "Ad spend ÷ low ticket sales from paid.",
                  status: adsActive ? kpiStatus(metrics?.cacLowTicketPaid, goals?.cpaLowTicket?.max, "lower") : null,
                  goal: adsActive ? kpiLabel(goals?.cpaLowTicket?.max, "lower", "currency") : null,
                },
                {
                  label: "AOV",
                  value: metrics?.averageOrderValueLowTicket,
                  format: "currency",
                  subtext: "Low ticket cash ÷ low ticket sales.",
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
                  subtext: "Ad spend ÷ high ticket calls booked.",
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
                  subtext: "Low ticket sales ÷ tracked leads.",
                },
                {
                  label: "Time To Close (Avg Days)",
                  value: metrics?.avgDaysToClose,
                  format: "number",
                  subtext: "Days from opt-in to the call that collected their cash.",
                },
              ],
            },
          ]}
        />
      </DashboardSection>

      {/* TIER 2 — REVENUE BREAKDOWN */}
      <DashboardSection title="Revenue Breakdown">
        <RevenueBreakdown
          lowTicketOrganic={metrics?.cashCollectedLowTicketOrganic}
          lowTicketPaid={metrics?.cashCollectedLowTicketPaid}
          highTicketOrganic={metrics?.cashCollectedHighTicketOrganic}
          highTicketPaid={metrics?.cashCollectedHighTicketPaid}
          revenueHighTicket={metrics?.revenueHighTicket}
          adSpend={metrics?.adSpend}
        />
      </DashboardSection>

      {/* TIER 3 — ACQUISITION & LEAD FLOW */}
      <DashboardSection title="Acquisition & Lead Flow">
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
            {
              title: "Paid Funnel",
              metrics: [
                {
                  label: "Cost Per Lead (Paid)",
                  value: metrics?.costPerLeadPaid,
                  format: "currency",
                  override: !adsActive ? notActive : undefined,
                  subtext: "From the daily metrics form.",
                  status: adsActive ? kpiStatus(metrics?.costPerLeadPaid, goals?.costPerLeadMeta?.max, "lower") : null,
                  goal: adsActive ? kpiLabel(goals?.costPerLeadMeta?.max, "lower", "currency") : null,
                },
                {
                  label: "Opt-In Rate (Paid)",
                  value: metrics?.optInRate,
                  format: "percent",
                  subtext: "From the form; if blank, paid leads ÷ VSL views.",
                  status: kpiStatus(metrics?.optInRate, goals?.optInRate?.min, "higher"),
                  goal: kpiLabel(goals?.optInRate?.min, "higher", "percent"),
                },
                {
                  label: "Landing Page Connect Rate",
                  value: metrics?.landingPageConnectRate,
                  format: "percent",
                  subtext: "From the form, averaged across the days in range.",
                  status: kpiStatus(metrics?.landingPageConnectRate, goals?.landingPageConnectRate?.min, "higher"),
                  goal: kpiLabel(goals?.landingPageConnectRate?.min, "higher", "percent"),
                },
              ],
            },
          ]}
        />
      </DashboardSection>

      {/* TIER 4 — FRONT-END SALES CONVERSION: the setter funnel left to right, dial to close */}
      <DashboardSection title="Front-End Sales Conversion">
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
              title: "Close Rate (Low Ticket)",
              value: metrics?.closeRateLowTicket,
              formula: "Software Closed ÷ Software Pitched.",
              status: kpiStatus(metrics?.closeRateLowTicket, goals?.closeRateLowTicket?.min, "higher"),
              goal: kpiLabel(goals?.closeRateLowTicket?.min, "higher", "percent"),
              inputs: [
                { label: "Software Closed", value: metrics?.softwareClosed },
                { label: "Software Pitched", value: metrics?.softwarePitched },
                { label: "Low Ticket Sales", value: metrics?.sales, note: "As logged on the daily metrics form." },
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
              title: "Booking Rate (From LT)",
              value: metrics?.highTicketBookingRateFromLowTicket,
              formula: "New HT calls booked ÷ Low Ticket Sales.",
              inputs: [
                { label: "New HT Calls Booked", value: metrics?.newHighTicketCallsBooked },
                { label: "Low Ticket Sales", value: metrics?.sales },
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

      {/* TIER 7 — FUNNEL & MARKETING HEALTH (diagnostic only) */}
      <DashboardSection title="Funnel, Marketing Health & Lead Sources — Diagnostic Only">
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
                  label: "Play Rate (Paid)",
                  value: metrics?.vslPlayRate,
                  format: "percent",
                  subtext: "Plays ÷ views, from VTurb.",
                  status: kpiStatus(metrics?.vslPlayRate, goals?.vslPlayRate?.min, "higher"),
                  goal: kpiLabel(goals?.vslPlayRate?.min, "higher", "percent"),
                },
                {
                  label: "Engagement Rate (Paid)",
                  value: metrics?.vslEngagementRate,
                  format: "percent",
                  subtext: "From VTurb.",
                  status: kpiStatus(metrics?.vslEngagementRate, goals?.vslEngagementRate?.min, "higher"),
                  goal: kpiLabel(goals?.vslEngagementRate?.min, "higher", "percent"),
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
                  subtext: "Low ticket sales from paid ÷ paid opt-ins.",
                  status: kpiStatus(metrics?.funnelConversionRatePaid, goals?.funnelConversionRate?.min, "higher"),
                  goal: kpiLabel(goals?.funnelConversionRate?.min, "higher", "percent"),
                },
                {
                  label: "Organic",
                  value: metrics?.funnelConversionRateOrganic,
                  format: "percent",
                  subtext: "Low ticket sales from organic ÷ organic opt-ins.",
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

      <DashboardSection title="Attribution — Base 44">
        <AttributionSection
          apiPath="/api/aval/overview/attribution"
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
          From the Marketing Daily Metrics form, tracked from September 2026.
        </p>
      </DashboardSection>

    </div>
  );
}
