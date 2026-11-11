"use client";

import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { Panel } from "@/components/berlin/Berlin";
import { formatStatValue } from "@/lib/format";
import type { AdSale } from "@/lib/sales-attribution";

/** Cortana files a sale on its date (a UTC-day block, 8 PM to 7 PM ET), so show the day. */
function day(hour: string) {
  return new Date(`${hour.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}


/** Sale by sale: which ad made it, when, how much, and who bought (matched to the Post Call Note). */
export function SalesByAd() {
  const { range } = useSharedRange();
  const { data } = useSectionData<{ sales: AdSale[] }>("/api/bronson/ads/sales", range, 300_000);
  const sales = Array.isArray(data?.sales) ? data!.sales : [];
  const total = sales.reduce((s, x) => s + x.amount, 0);
  return (
    <Panel className="mb-6 overflow-hidden p-0">
      <div className="border-b border-[var(--panel-border)] px-5 py-4">
        <div className="text-[15px] font-semibold text-[var(--text-strong)]">Sales by ad</div>
        <div className="text-[12px] text-[var(--text-muted)]">
          Every sale Cortana credited to an ad and the day it landed (Cortana files sales by day, not by hour). Matched to the post call note logged that day for the same amount.
          {sales.length ? ` ${sales.length} sales · ${formatStatValue(total, "currency")}.` : ""}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
              <th className="px-5 py-3 font-medium">Day</th>
              <th className="px-3 py-3 font-medium">Ad</th>
              <th className="px-3 py-3 text-right font-medium">Amount</th>
              <th className="px-3 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">Closer</th>
              <th className="px-5 py-3 font-medium">Offer</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s, i) => (
              <tr key={`${s.hour}-${s.adId}-${i}`} className="border-t border-[var(--panel-border)]">
                <td className="whitespace-nowrap px-5 py-2.5 text-[var(--text-muted)]">{day(s.lastHour || s.hour)}</td>
                <td className="max-w-[300px] px-3 py-2.5 font-medium text-[var(--text-strong)]"><div className="truncate" title={s.ad}>{s.ad}</div></td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatStatValue(s.amount, "currency")}{s.highTicket ? <span className="ml-1.5 rounded bg-[var(--cell-green-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--cell-green-text)]">HT</span> : null}</td>
                <td className="px-3 py-2.5">{s.matched ? s.customer ?? "—" : <span className="text-[var(--text-muted)]">{s.highTicket ? "No matching call note" : "VIP / other purchase"}</span>}</td>
                <td className="px-3 py-2.5 text-[var(--text-muted)]">{s.closer ?? "—"}</td>
                <td className="px-5 py-2.5 text-[var(--text-muted)]">{s.offer ?? "—"}</td>
              </tr>
            ))}
            {data && !sales.length ? <tr><td colSpan={6} className="px-5 py-8 text-center text-[var(--text-muted)]">No sales credited to an ad in this range.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
