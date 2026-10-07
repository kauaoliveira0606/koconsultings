"use client";

import { StatCard, type StatCardStatus } from "@/components/dashboard/StatCard";
import { StatCardGrid, DashboardSection } from "@/components/dashboard/StatCardGrid";
import { AttributionSection } from "@/components/dashboard/AttributionSection";
import { RevenueBreakdown, addCash } from "@/components/dashboard/RevenueBreakdown";
import { OfferSplitSection } from "@/components/dashboard/OfferSplitSection";
import { MetricGroups } from "@/components/dashboard/MetricGroups";
import { PieSplit } from "@/components/dashboard/PieSplit";
import { RateColumns } from "@/components/dashboard/RateColumns";
import { PaidPnlSection } from "@/components/dashboard/PaidPnlSection";
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
        <LiveCashToday apiPath="/api/bronson/overview/live-cash" />
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
              ],
            },
          ]}
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Sales — Low Ticket"
            value={metrics?.sales}
            format="number"
            subtext="From Marketing Daily Metrics."
            status={kpiStatus(metrics?.sales, goals?.salesLowTicket, "higher")}
            goal={kpiLabel(goals?.salesLowTicket, "higher", "number")}
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
        </div>
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
        <OfferSplitSection apiPath="/api/bronson/overview/offer-split" range={range} />
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
            subtext="Low ticket sales from paid ÷ paid opt-ins."
            status={kpiStatus(metrics?.funnelConversionRatePaid, goals?.funnelConversionRate?.min, "higher")}
            goal={kpiLabel(goals?.funnelConversionRate?.min, "higher", "percent")}
          />
          <StatCard
            label="Funnel Conversion Rate (Organic)"
            value={metrics?.funnelConversionRateOrganic}
            format="percent"
            subtext="Low ticket sales from organic ÷ organic opt-ins."
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
          goal={goals?.attributionRate?.min}
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

      {/* Owner's own reference, not one of the offer's real stats — kept last. */}
      <PaidPnlSection apiPath="/api/bronson/overview/pnl" range={range} />
    </div>
  );
}
