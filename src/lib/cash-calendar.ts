import type { MarketingDailyMetricRow } from "./airtable/tables";

export type CashByDay = Record<string, number>;

/** Sums low-ticket + high-ticket cash collected per date (YYYY-MM-DD). */
export function getCashByDay(rows: MarketingDailyMetricRow[]): CashByDay {
  const byDay: CashByDay = {};
  for (const row of rows) {
    if (!row.date) continue;
    const dayTotal = (row.cashCollectedLowTicket ?? 0) + (row.cashCollectedHighTicket ?? 0);
    byDay[row.date] = (byDay[row.date] ?? 0) + dayTotal;
  }
  return byDay;
}

export type CashSourceByDay = Record<string, { paid: number; organic: number }>;

/**
 * Paid/Organic split per date, straight from the Marketing Daily Metrics
 * form's own "(Paid)"/"(Organic)" columns (Low Ticket + High Ticket
 * combined) — NOT the Affiliate PCN/EOD cross-reference, which is
 * independently submitted and doesn't reliably sum to the real cash total.
 * These always sum exactly to getCashByDay's total for the same row, since
 * both come from the same splitCash() reconciliation in the parser.
 */
export function getCashSourceByDay(rows: MarketingDailyMetricRow[]): CashSourceByDay {
  const byDay: CashSourceByDay = {};
  for (const row of rows) {
    if (!row.date) continue;
    const paid = (row.cashCollectedLowTicketPaid ?? 0) + (row.cashCollectedHighTicketPaid ?? 0);
    const organic =
      (row.cashCollectedLowTicketOrganic ?? 0) + (row.cashCollectedHighTicketOrganic ?? 0);
    const prev = byDay[row.date] ?? { paid: 0, organic: 0 };
    byDay[row.date] = { paid: prev.paid + paid, organic: prev.organic + organic };
  }
  return byDay;
}

/** Sums Meta ad spend per date (YYYY-MM-DD). */
export function getAdSpendByDay(rows: MarketingDailyMetricRow[]): CashByDay {
  const byDay: CashByDay = {};
  for (const row of rows) {
    if (!row.date) continue;
    byDay[row.date] = (byDay[row.date] ?? 0) + (row.adSpendMeta ?? 0);
  }
  return byDay;
}

export function filterByMonth<T>(
  byDay: Record<string, T>,
  month: string /* YYYY-MM */
): Record<string, T> {
  const filtered: Record<string, T> = {};
  for (const [date, value] of Object.entries(byDay)) {
    if (date.startsWith(month)) filtered[date] = value;
  }
  return filtered;
}

/**
 * Maps a day's cash total to one of 6 shading buckets (0 = none, 5 = most),
 * relative to the max value seen in the same month, so the scale auto-adapts
 * as revenue grows instead of needing re-tuned fixed dollar thresholds.
 */
export function bucketIntensity(value: number, maxInMonth: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (value <= 0 || maxInMonth <= 0) return 0;
  const ratio = value / maxInMonth;
  if (ratio >= 0.8) return 5;
  if (ratio >= 0.6) return 4;
  if (ratio >= 0.4) return 3;
  if (ratio >= 0.2) return 2;
  return 1;
}

export function monthTotal(byDay: CashByDay): number {
  return Object.values(byDay).reduce((a, b) => a + b, 0);
}
