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

export function filterByMonth(byDay: CashByDay, month: string /* YYYY-MM */): CashByDay {
  const filtered: CashByDay = {};
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
