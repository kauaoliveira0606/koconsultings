"use client";

import { PieSplit } from "@/components/dashboard/PieSplit";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatStatValue } from "@/lib/format";
import type { OfferSplitResponse } from "@/lib/offer-split";
import { useSectionData } from "@/lib/use-section-data";

const PANEL =
  "rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm";

/**
 * Share of high ticket buyers on each offer, as a pie (one slice per offer on
 * the post call note form, named as it is there), with the PIF rate (paid in
 * full vs payment plan or deposit) beside it. Follows the selected range.
 */
export function OfferSplitSection({ apiPath, range }: { apiPath: string; range: RangeState }) {
  const { data } = useSectionData<OfferSplitResponse>(apiPath, range);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className={`${PANEL} lg:col-span-2`}>
        <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Offers Bought
        </div>
        {data ? (
          <PieSplit
            unit={["deal", "deals"]}
            emptyText="No closed deals in the post call notes for this range."
            slices={data.offers.map((o) => ({
              key: o.key,
              label: o.label,
              value: o.deals,
              detail: `${formatStatValue(o.cashCollected, "currency")} collected on the calls · ${formatStatValue(o.dealValue, "currency")} deal value`,
            }))}
          />
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <StatCard
          label="PIF Rate"
          value={data?.pifRate}
          format="percent"
          size="lg"
          subtext={
            data
              ? `${data.paidInFull} of ${data.total} deals paid in full. ${data.paymentPlans} on a payment plan, ${data.deposits} deposit${data.deposits === 1 ? "" : "s"}.`
              : "Paid in full ÷ total deals."
          }
        />
        <StatCard
          label="Total Deals"
          value={data?.total}
          format="number"
          size="lg"
          subtext="Post call notes with outcome Closed (PIF), Payment Plan or Deposit."
        />
      </div>
    </div>
  );
}
