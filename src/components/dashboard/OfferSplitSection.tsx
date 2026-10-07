"use client";

import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardGrid } from "@/components/dashboard/StatCardGrid";
import { formatStatValue } from "@/lib/format";
import type { OfferSplitResponse } from "@/lib/offer-split";
import { useSectionData } from "@/lib/use-section-data";

/**
 * Share of high ticket buyers on each offer ($1K downsell, $3K, $5K, upsell)
 * and the PIF rate (paid in full vs payment plan or deposit), from the post
 * call notes, for the selected range.
 */
export function OfferSplitSection({ apiPath, range }: { apiPath: string; range: RangeState }) {
  const { data } = useSectionData<OfferSplitResponse>(apiPath, range);

  if (data && data.total === 0) {
    return (
      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-sm text-[var(--text-muted)] backdrop-blur-sm">
        No closed deals in the post call notes for this range.
      </div>
    );
  }

  return (
    <StatCardGrid>
      {(data?.offers ?? []).map((o) => (
        <StatCard
          key={o.key}
          label={o.label}
          value={o.share}
          format="percent"
          subtext={`${o.deals} of ${data?.total} deals. ${formatStatValue(o.cashCollected, "currency")} collected on the calls, ${formatStatValue(o.dealValue, "currency")} deal value.`}
        />
      ))}
      <StatCard
        label="PIF Rate"
        value={data?.pifRate}
        format="percent"
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
        subtext="Post call notes with outcome Closed (PIF), Payment Plan or Deposit."
      />
    </StatCardGrid>
  );
}
