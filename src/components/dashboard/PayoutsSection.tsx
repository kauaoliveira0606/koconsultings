"use client";

import type { RangeState } from "@/components/dashboard/RangeFilterBar";
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
 * Admin Team "Payouts" for the selected range: cash collected by kind, what
 * comes off it, and the payable share (the cash the split is taken on).
 */
export function PayoutsSection({ apiPath, range }: { apiPath: string; range: RangeState }) {
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
                : "11.5% of the payable share."
            }
          />
        </div>
      </div>
    </div>
  );
}
