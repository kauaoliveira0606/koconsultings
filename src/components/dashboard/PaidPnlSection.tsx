"use client";

import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue } from "@/lib/format";
import type { PaidPnl } from "@/lib/bronson-paid-pnl";

/** One line of the paid-traffic P&L. Costs show in red with a minus sign. */
function PnlCard({
  label,
  value,
  subtext,
  cost = false,
}: {
  label: string;
  value: number | undefined;
  subtext?: string;
  cost?: boolean;
}) {
  const formatted = formatStatValue(value, "currency");
  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-bold ${cost ? "text-red-400" : "text-[var(--text-strong)]"}`}
      >
        {cost && value ? `-${formatted}` : formatted}
      </div>
      {subtext ? (
        <div className="mt-1 text-xs text-[var(--text-muted)]">{subtext}</div>
      ) : null}
    </div>
  );
}

/**
 * Overview "PNL" for the selected range: what paid traffic brought in and
 * what came off it, then organic cash on its own (no deductions). Low ticket
 * is true (portal-attributed) cash, with the logged figure alongside.
 */
export function PaidPnlSection({
  apiPath,
  range,
}: {
  apiPath: string;
  range: RangeState;
}) {
  const { data } = useSectionData<PaidPnl>(apiPath, range);
  const money = (value: number | undefined) =>
    formatStatValue(value, "currency");
  const rate = formatStatValue(data?.lowTicketAttributionRate, "percent");
  return (
    <>
      <DashboardSection title="PNL (Paid Traffic)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <PnlCard
            label="Cash Collected"
            value={data?.cash}
            subtext={`True cash: low ticket ${money(data?.paidCashLowTicket)} attributed (${money(data?.loggedLowTicketPaid)} logged) + high ticket ${money(data?.paidCashHighTicket)}.`}
          />
          <PnlCard
            label="Sales Team Commission"
            value={data?.salesTeamCommission}
            subtext="Paid-traffic commissions only."
            cost
          />
          <PnlCard label="Ad Spend" value={data?.adSpend} cost />
          <PnlCard
            label="Expenses"
            value={data?.expenses}
            subtext="Monthly bills, booked on the 1st."
            cost
          />
          <PnlCard
            label="Fees"
            value={data?.fees}
            subtext="High ticket only: 3% processing, plus 15% on financed deals. From October 2026."
            cost
          />
          <PnlCard
            label="Paid Profit"
            value={data?.profit}
            subtext="True cash minus the four costs."
          />
        </div>
      </DashboardSection>

      <DashboardSection title="PNL (Organic)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <PnlCard
            label="Cash Collected"
            value={data?.organicCash}
            subtext="True cash: attributed low ticket + high ticket. Nothing comes off it."
          />
          <PnlCard
            label="Low Ticket (Attributed)"
            value={data?.organicCashLowTicket}
            subtext={`${money(data?.loggedLowTicketOrganic)} logged x ${rate} attribution.`}
          />
          <PnlCard label="High Ticket" value={data?.organicCashHighTicket} />
          <PnlCard
            label="Low Ticket Attribution"
            value={data?.portalLowTicketCash}
            subtext={`${rate} of logged low ticket. The portal tracked this much of ${money((data?.loggedLowTicketPaid ?? 0) + (data?.loggedLowTicketOrganic ?? 0))} logged; paid and organic are split in the logged proportion.`}
          />
        </div>
      </DashboardSection>
    </>
  );
}
