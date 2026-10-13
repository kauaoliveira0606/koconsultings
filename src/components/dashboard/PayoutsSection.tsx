"use client";

import { useMemo, useState } from "react";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { addDaysToDateString, easternDateString } from "@/lib/date-range";
import { buildPayPeriods, type PayPeriodOptions } from "@/lib/pay-periods";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue } from "@/lib/format";
import type { Payouts } from "@/lib/payouts";

function PayoutCard({
  label,
  value,
  subtext,
  cost = false,
  strong = false,
}: {
  label: string;
  value: number | undefined;
  subtext?: string;
  cost?: boolean;
  strong?: boolean;
}) {
  const formatted = formatStatValue(value, "currency");
  return (
    <div
      className={`rounded-lg border bg-[var(--panel-bg)] p-4 backdrop-blur-sm ${strong ? "border-emerald-400/60" : "border-[var(--panel-border)]"}`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-bold ${cost ? "text-red-400" : "text-[var(--text-strong)]"}`}
      >
        {cost && value ? `-${formatted}` : formatted}
      </div>
      {subtext ? <div className="mt-1 text-xs text-[var(--text-muted)]">{subtext}</div> : null}
    </div>
  );
}

const GROUP_TITLE =
  "mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-strong)]";

/**
 * Admin Team "Payouts" for one pay period: cash collected by kind, what
 * comes off it, and the payable share (the cash the split is taken on).
 * Payouts go out per pay period (Aval weekly Monday to Sunday, Bronson the
 * 1st-15th and 16th-end), so this has its own period picker instead of the
 * page's date range.
 */
export function PayoutsSection({
  apiPath,
  payPeriods,
}: {
  apiPath: string;
  payPeriods: PayPeriodOptions;
}) {
  const { cadence, firstMonth, firstMonthSplitDay } = payPeriods;
  const periods = useMemo(
    () => buildPayPeriods({ cadence, firstMonth, firstMonthSplitDay }),
    [cadence, firstMonth, firstMonthSplitDay]
  );
  // Same opening rule as the Commissions tab: for the first three days of a
  // new period, open on the one that just ended, since that is the one being paid.
  const defaultKey = useMemo(() => {
    const [current, previous] = periods.filter((p) => p.kind === "period");
    const justStarted = current && easternDateString() <= addDaysToDateString(current.start, 2);
    return (justStarted && previous ? previous : current)?.key ?? periods[0]?.key ?? "";
  }, [periods]);
  const [periodKey, setPeriodKey] = useState(defaultKey);
  const period = periods.find((p) => p.key === periodKey) ?? periods[0];
  const range: RangeState = {
    preset: "custom",
    customStart: period?.start,
    customEnd: period?.end,
  };
  const { data } = useSectionData<Payouts>(apiPath, range);
  const money = (value: number | undefined) => formatStatValue(value, "currency");
  const bronson = data?.offer === "bronson";
  const alsoOff = data
    ? [
        data.fees ? `${money(data.fees)} processing and financing fees` : null,
        data.expenses ? `${money(data.expenses)} monthly bills` : null,
      ].filter(Boolean)
    : [];
  return (
    <div className="space-y-6">
      <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
        Pay period
        <select
          value={period?.key ?? ""}
          onChange={(e) => setPeriodKey(e.target.value)}
          className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm font-medium text-[var(--text-strong)]"
        >
          <optgroup label="Pay periods">
            {periods
              .filter((p) => p.kind === "period")
              .map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
          </optgroup>
          <optgroup label="Full months">
            {periods
              .filter((p) => p.kind === "month")
              .map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
          </optgroup>
        </select>
        <span>
          {cadence === "weekly"
            ? "Paid weekly, Monday to Sunday."
            : "Paid twice a month: the 1st to the 15th, then the 16th to month end."}
        </span>
      </label>

      <div>
        <div className={GROUP_TITLE}>Cash Collected</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <PayoutCard
            label="Affiliate"
            value={data?.cashAffiliate}
            subtext={
              bronson
                ? "Attributed: what the affiliate portal tracked and pays on."
                : "As logged on the daily metrics form."
            }
          />
          <PayoutCard label="VIP" value={data?.cashVip} subtext="Webinar VIP purchases." />
          <PayoutCard label="High Ticket" value={data?.cashHighTicket} />
          <PayoutCard
            label="Total Cash Collected"
            value={data?.totalCash}
            subtext="Affiliate + VIP + high ticket."
          />
        </div>
      </div>

      <div>
        <div className={GROUP_TITLE}>Comes Off</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <PayoutCard label="Ad Spend" value={data?.adSpend} cost />
          <PayoutCard
            label="Sales Team Payout"
            value={data?.salesTeamPayout}
            subtext={
              bronson
                ? "Paid-traffic commissions from the Commissions tab."
                : "Setter and closer commissions. Nothing before October 2026."
            }
            cost
          />
        </div>
      </div>

      <div>
        <div className={GROUP_TITLE}>Payable</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <PayoutCard
            label="Total Payable Share"
            value={data?.payableShare}
            subtext={`The cash we get paid on: ${money(data?.payablePaid)} paid + ${money(data?.payableOrganic)} organic.${alsoOff.length ? ` Also off: ${alsoOff.join(", ")}.` : ""}`}
            strong
          />
          <PayoutCard
            label="Our Share"
            value={data?.agencyShare}
            subtext={
              bronson
                ? "50% of the paid share + 20% of the organic share."
                : "35% of the payable share."
            }
          />
        </div>
      </div>
    </div>
  );
}
