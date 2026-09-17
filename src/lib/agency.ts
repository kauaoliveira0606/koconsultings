/**
 * Shared math for the personal Agency rollup (/agency) — the one place
 * that intentionally combines all three offers' data, to answer "what does
 * KOconsultings actually take home." Every individual offer dashboard
 * stays isolated to its own base; this is the deliberate aggregator.
 */
import { isDateInRange, type ResolvedRange } from "./date-range";
import { sumByDate } from "./metrics";

/** Sun/Sat get the 20% affiliate commission rate; Mon–Fri get 10%. Same rule every offer already uses. */
function isWeekendDate(dateStr: string): boolean {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** Sales team commission on a day's cash: 10%/20% weekday/weekend on Low Ticket, flat 15% on High Ticket. */
function commissionForDay(date: string, ltCash: number, htCash: number): number {
  return ltCash * (isWeekendDate(date) ? 0.2 : 0.1) + htCash * 0.15;
}

export type DailyOfferRow = {
  date: string;
  ltCashPaid: number;
  ltCashOrganic: number;
  htCashPaid: number;
  htCashOrganic: number;
  adSpend: number;
};

type MarketingRowLike = {
  date: string | null;
  cashCollectedLowTicketPaid: number | null;
  cashCollectedLowTicketOrganic: number | null;
  cashCollectedHighTicketPaid: number | null;
  adSpendMeta: number | null;
};

/**
 * Merges the Marketing Daily Metrics form's Low Ticket Paid/Organic split
 * with the offer's real (preferred-source-blended) High Ticket cash per
 * day. Only the form tracks a Paid/Organic split for High Ticket — a day
 * with no explicit Paid figure there is treated as fully Organic, which
 * matches current reality across every offer (no paid HT deal has closed
 * yet anywhere) rather than being left unattributed.
 */
export function buildDailyOfferRows(
  marketing: MarketingRowLike[],
  htCashByDayBlended: Map<string, number>
): DailyOfferRow[] {
  const ltPaidByDay = sumByDate(marketing, (r) => r.date, (r) => r.cashCollectedLowTicketPaid);
  const ltOrganicByDay = sumByDate(
    marketing,
    (r) => r.date,
    (r) => r.cashCollectedLowTicketOrganic
  );
  const htPaidTypedByDay = sumByDate(
    marketing,
    (r) => r.date,
    (r) => r.cashCollectedHighTicketPaid
  );
  const adSpendByDay = sumByDate(marketing, (r) => r.date, (r) => r.adSpendMeta);

  const dates = new Set<string>([
    ...ltPaidByDay.keys(),
    ...ltOrganicByDay.keys(),
    ...htPaidTypedByDay.keys(),
    ...adSpendByDay.keys(),
    ...htCashByDayBlended.keys(),
  ]);

  const rows: DailyOfferRow[] = [];
  for (const date of dates) {
    const htTotal = htCashByDayBlended.get(date) ?? 0;
    const htPaid = Math.min(htPaidTypedByDay.get(date) ?? 0, htTotal);
    rows.push({
      date,
      ltCashPaid: ltPaidByDay.get(date) ?? 0,
      ltCashOrganic: ltOrganicByDay.get(date) ?? 0,
      htCashPaid: htPaid,
      htCashOrganic: Math.max(0, htTotal - htPaid),
      adSpend: adSpendByDay.get(date) ?? 0,
    });
  }
  return rows;
}

function cash(r: DailyOfferRow): number {
  return r.ltCashPaid + r.ltCashOrganic + r.htCashPaid + r.htCashOrganic;
}

export function sumCash(rows: DailyOfferRow[]): number {
  return rows.reduce((total, r) => total + cash(r), 0);
}

export function sumAdSpend(rows: DailyOfferRow[]): number {
  return rows.reduce((total, r) => total + r.adSpend, 0);
}

/** Total sales team commission, split by Paid vs Organic traffic. */
export function sumSalesTeamPayout(rows: DailyOfferRow[]): { paid: number; organic: number } {
  let paid = 0;
  let organic = 0;
  for (const r of rows) {
    paid += commissionForDay(r.date, r.ltCashPaid, r.htCashPaid);
    organic += commissionForDay(r.date, r.ltCashOrganic, r.htCashOrganic);
  }
  return { paid, organic };
}

/** Generic client P&L, same shape as every offer's own "Net Cash" stat. */
export function profit(rows: DailyOfferRow[]): number {
  const { paid, organic } = sumSalesTeamPayout(rows);
  return sumCash(rows) - sumAdSpend(rows) - (paid + organic);
}

/** Bronson: 50% agency share of Paid profit (after ad spend + sales team), plus 20% of Organic top-line cash. */
export function bronsonAgencyProfit(rows: DailyOfferRow[]): number {
  const cashPaid = rows.reduce((t, r) => t + r.ltCashPaid + r.htCashPaid, 0);
  const cashOrganic = rows.reduce((t, r) => t + r.ltCashOrganic + r.htCashOrganic, 0);
  const adSpend = sumAdSpend(rows);
  const { paid: payoutPaid } = sumSalesTeamPayout(rows);
  const paidProfit = cashPaid - adSpend - payoutPaid;
  return 0.5 * paidProfit + 0.2 * cashOrganic;
}

/** Aval: flat 11.5% of top-line cash, minus ad spend — no sales team deduction. */
export function avalAgencyProfit(rows: DailyOfferRow[]): number {
  return 0.115 * sumCash(rows) - sumAdSpend(rows);
}

/**
 * Andy (Ecom Simulation): 17.5% organic / 22.5% paid, doubling to 35%/45%
 * once that CALENDAR MONTH's combined (organic + paid) cash crosses
 * $100k — the whole month's cash re-rates at the higher tier, not just the
 * amount above $100k. `allRows` must be unfiltered by date range (every
 * row this offer has ever logged) so a month's tier is judged on its full
 * total even when the dashboard is viewing a narrower range within it;
 * only the portion of that month's rows inside `range` contributes dollars.
 */
export function ecomSimAgencyProfit(allRows: DailyOfferRow[], range: ResolvedRange): number {
  const monthCash = new Map<string, number>();
  for (const r of allRows) {
    const month = r.date.slice(0, 7);
    monthCash.set(month, (monthCash.get(month) ?? 0) + cash(r));
  }

  let agencyProfit = 0;
  for (const r of allRows) {
    if (!isDateInRange(r.date, range)) continue;
    const month = r.date.slice(0, 7);
    const tierHit = (monthCash.get(month) ?? 0) > 100_000;
    const rateOrganic = tierHit ? 0.35 : 0.175;
    const ratePaid = tierHit ? 0.45 : 0.225;
    const { paid: payoutPaid, organic: payoutOrganic } = sumSalesTeamPayout([r]);
    const organicProfit = r.ltCashOrganic + r.htCashOrganic - payoutOrganic;
    const paidProfit = r.ltCashPaid + r.htCashPaid - r.adSpend - payoutPaid;
    agencyProfit += rateOrganic * organicProfit + ratePaid * paidProfit;
  }
  return agencyProfit;
}
