"use client";

import type { StatCardStatus } from "@/components/dashboard/StatCard";
import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { RevenueBreakdown, addCash } from "@/components/dashboard/RevenueBreakdown";
import { OfferSplitSection } from "@/components/dashboard/OfferSplitSection";
import { SalesCycleSection } from "@/components/dashboard/SalesCycleSection";
import type { SalesCycleResponse } from "@/lib/sales-cycle";
import { MetricGroups } from "@/components/dashboard/MetricGroups";
import { HeroStat } from "@/components/dashboard/HeroStat";
import { rangePeriodLabel } from "@/lib/range-label";
import type { WebinarTotals } from "@/lib/metrics";
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
  funnelConversionRatePaid: number | null;
  funnelConversionRateOrganic: number | null;

  webinar: WebinarTotals;
  bronsonAi: {
    price: number;
    sales: number | null;
    salesPaid: number | null;
    salesOrganic: number | null;
    cash: number | null;
    cashPaid: number | null;
    cashOrganic: number | null;
    churned: number | null;
    netNew: number | null;
    churnRate: number | null;
    lostMonthly: number | null;
    lostYearly: number | null;
    newMonthly: number | null;
  };
  refundCount: number | null;
  refundDollars: number | null;
  chargebackCount: number | null;
  chargebackDollars: number | null;
  refundChargebackDollars: number | null;
  refundChargebackRate: number | null;
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
  const { data: salesCycle } = useSectionData<SalesCycleResponse>("/api/bronson/overview/sales-cycle", range);

  const { data: metrics } = useSectionData<MetricsResponse>("/api/bronson/overview/metrics", range);
  const { data: goals } = useSectionData<GoalsConfig>("/api/bronson/goals", range);

  const adsActive = metrics?.adsActive ?? false;
  // Paid ROAS counts ALL paid cash: high ticket, webinar VIP and Bronson AI (plus any old affiliate cash), as split on the form.
  const paidCash = addCash(
    metrics?.cashCollectedLowTicketPaid,
    metrics?.cashCollectedHighTicketPaid,
    metrics?.webinar.vipCashPaid,
    metrics?.bronsonAi?.cashPaid
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
        <LiveCashToday apiPath="/api/bronson/overview/live-cash" showAffiliate={false} />
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
            label="High Ticket Cash"
            value={metrics?.cashCollectedHighTicket}
            format="currency"
            sub={`${formatStatValue(metrics?.cashCollectedHighTicketPaid, "currency")} paid · ${formatStatValue(metrics?.cashCollectedHighTicketOrganic, "currency")} organic`}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
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
          showAffiliate={false}
          lowTicketOrganic={metrics?.cashCollectedLowTicketOrganic}
          lowTicketPaid={metrics?.cashCollectedLowTicketPaid}
          highTicketOrganic={metrics?.cashCollectedHighTicketOrganic}
          highTicketPaid={metrics?.cashCollectedHighTicketPaid}
          vipOrganic={metrics?.webinar.vipCashOrganic}
          vipPaid={metrics?.webinar.vipCashPaid}
          aiOrganic={metrics?.bronsonAi?.cashOrganic ?? null}
          aiPaid={metrics?.bronsonAi?.cashPaid ?? null}
          revenueHighTicket={metrics?.revenueHighTicket}
          adSpend={metrics?.adSpend}
        />
      </DashboardSection>

      {/* UNIT ECONOMICS: what a customer costs against what they pay, per ticket. */}
      <DashboardSection title="Unit Economics">
        <MetricGroups
          groups={[
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
          ]}
        />
      </DashboardSection>

      <DashboardSection title="Offer Split & PIF Rate">
        <OfferSplitSection apiPath="/api/bronson/overview/offer-split" range={range} />
      </DashboardSection>

      <DashboardSection title="Sales Cycle">
        <SalesCycleSection apiPath="/api/bronson/overview/sales-cycle" range={range} period={period} />
      </DashboardSection>

      {/* BRONSON AI: the $147/mo subscription, its own product (not part of the webinar). */}
      <DashboardSection title="Bronson AI ($147/mo)">
        <MetricGroups
          groups={[
            {
              title: "Sales",
              metrics: [
                { label: "Sold", value: metrics?.bronsonAi?.sales, format: "number", subtext: "New subscriptions, paid + organic." },
                { label: "Sold (Paid)", value: metrics?.bronsonAi?.salesPaid, format: "number" },
                { label: "Sold (Organic)", value: metrics?.bronsonAi?.salesOrganic, format: "number" },
                { label: "Cash Collected", value: metrics?.bronsonAi?.cash, format: "currency", subtext: "Paid + organic." },
                { label: "Cash Collected (Paid)", value: metrics?.bronsonAi?.cashPaid, format: "currency" },
                { label: "Cash Collected (Organic)", value: metrics?.bronsonAi?.cashOrganic, format: "currency" },
                {
                  label: "New Monthly Billing",
                  value: metrics?.bronsonAi?.newMonthly,
                  format: "currency",
                  subtext: "Sold × $147: what the new subscribers add each month.",
                },
              ],
            },
            {
              title: "Churn",
              metrics: [
                { label: "Churned", value: metrics?.bronsonAi?.churned, format: "number", subtext: "Subscribers who cancelled." },
                {
                  label: "Lost Monthly Billing",
                  value: metrics?.bronsonAi?.lostMonthly,
                  format: "currency",
                  subtext: "Churned × $147: what we stop collecting every month.",
                },
                {
                  label: "Lost Over 12 Months",
                  value: metrics?.bronsonAi?.lostYearly,
                  format: "currency",
                  subtext: "Lost monthly billing × 12.",
                },
                {
                  label: "Net New Subscribers",
                  value: metrics?.bronsonAi?.netNew,
                  format: "number",
                  subtext: "Sold − churned.",
                },
                {
                  label: "Churn vs Sold",
                  value: metrics?.bronsonAi?.churnRate,
                  format: "percent",
                  subtext: "Churned ÷ sold in this range.",
                },
              ],
            },
          ]}
        />
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          From the Marketing Daily Metrics form (the closers&apos; EOD fills the Sold count on days the form left blank). Bronson AI cash counts in Total Cash Collected, ROAS, Net Cash and the paid / organic splits, with 2.5% processing and no sales commission.
        </p>
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

      {/* Owner's own reference, not one of the offer's real stats — kept last. */}
      <PaidPnlSection apiPath="/api/bronson/overview/pnl" range={range} />
    </div>
  );
}
