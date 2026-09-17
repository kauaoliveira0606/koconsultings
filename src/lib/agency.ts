/**
 * Shared math for the personal Agency rollup (/agency) — the one place
 * that intentionally combines all three offers' data, to answer "what does
 * KOconsultings actually take home." Every individual offer dashboard
 * stays isolated to its own base; this is the deliberate aggregator.
 */
import { isDateInRange, type ResolvedRange } from "./date-range";
import { sumByDate } from "./metrics";

/** Data before this date is out of scope for the agency rollup entirely, per the client. */
export const AGENCY_DATA_START = "2026-09-01";

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
  cashCollectedLowTicket: number | null;
  cashCollectedLowTicketPaid: number | null;
  cashCollectedHighTicket: number | null;
  cashCollectedHighTicketPaid: number | null;
  adSpendMeta: number | null;
};

/**
 * Everything here comes straight from the Marketing Daily Metrics table —
 * no EOD Closer / Affiliate EOD blending, per the client. Only an explicit
 * Paid figure ever gets typed into the form — Organic is whatever's left
 * of that day's TOTAL cash (Low or High Ticket) after subtracting Paid,
 * and a day with no Paid figure at all is treated as fully Organic (rather
 * than dropped) so a day's cash is never silently lost just because the
 * split wasn't recorded. Anything before `AGENCY_DATA_START` is dropped
 * entirely — August and earlier is out of scope for this rollup.
 */
export function buildDailyOfferRows(marketing: MarketingRowLike[]): DailyOfferRow[] {
  marketing = marketing.filter((r) => r.date !== null && r.date >= AGENCY_DATA_START);
  const ltTotalByDay = sumByDate(marketing, (r) => r.date, (r) => r.cashCollectedLowTicket);
  const ltPaidTypedByDay = sumByDate(
    marketing,
    (r) => r.date,
    (r) => r.cashCollectedLowTicketPaid
  );
  const htTotalByDay = sumByDate(marketing, (r) => r.date, (r) => r.cashCollectedHighTicket);
  const htPaidTypedByDay = sumByDate(
    marketing,
    (r) => r.date,
    (r) => r.cashCollectedHighTicketPaid
  );
  const adSpendByDay = sumByDate(marketing, (r) => r.date, (r) => r.adSpendMeta);

  const dates = new Set<string>([
    ...ltTotalByDay.keys(),
    ...htTotalByDay.keys(),
    ...adSpendByDay.keys(),
  ]);

  const rows: DailyOfferRow[] = [];
  for (const date of dates) {
    // The typed Paid figure is real cash regardless of whether the Total
    // field was ever filled in for that day — some offers' teams only type
    // the Paid split and leave Total blank. Total is a FLOOR, never a cap:
    // if Paid alone exceeds it (or Total is blank), Total is treated as at
    // least Paid, so real typed cash is never clamped down to 0.
    const ltPaid = ltPaidTypedByDay.get(date) ?? 0;
    const ltTotal = Math.max(ltTotalByDay.get(date) ?? 0, ltPaid);
    const htPaid = htPaidTypedByDay.get(date) ?? 0;
    const htTotal = Math.max(htTotalByDay.get(date) ?? 0, htPaid);
    rows.push({
      date,
      ltCashPaid: ltPaid,
      ltCashOrganic: Math.max(0, ltTotal - ltPaid),
      htCashPaid: htPaid,
      htCashOrganic: Math.max(0, htTotal - htPaid),
      adSpend: adSpendByDay.get(date) ?? 0,
    });
  }
  return rows;
}

export function cash(r: DailyOfferRow): number {
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

/** Bronson: 50% agency share of Paid profit (after ad spend + sales team), plus 20% of Organic top-line cash — per day. */
export function bronsonAgencyProfitByDay(rows: DailyOfferRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const cashPaid = r.ltCashPaid + r.htCashPaid;
    const cashOrganic = r.ltCashOrganic + r.htCashOrganic;
    const { paid: payoutPaid } = sumSalesTeamPayout([r]);
    const paidProfit = cashPaid - r.adSpend - payoutPaid;
    map.set(r.date, 0.5 * paidProfit + 0.2 * cashOrganic);
  }
  return map;
}

export function bronsonAgencyProfit(rows: DailyOfferRow[]): number {
  return sumMapValues(bronsonAgencyProfitByDay(rows));
}

/** Aval: flat 11.5% of top-line cash, minus ad spend — no sales team deduction — per day. */
export function avalAgencyProfitByDay(rows: DailyOfferRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.date, 0.115 * cash(r) - r.adSpend);
  }
  return map;
}

export function avalAgencyProfit(rows: DailyOfferRow[]): number {
  return sumMapValues(avalAgencyProfitByDay(rows));
}

/**
 * Andy (Ecom Simulation): 17.5% organic / 22.5% paid, doubling to 35%/45%
 * once that CALENDAR MONTH's combined (organic + paid) cash crosses
 * $100k — the whole month's cash re-rates at the higher tier, not just the
 * amount above $100k. `allRows` must be unfiltered by date range (every
 * row this offer has ever logged) so a month's tier is judged on its full
 * total even when only a narrower slice of it is being summed.
 */
export function ecomSimAgencyProfitByDay(allRows: DailyOfferRow[]): Map<string, number> {
  const monthCash = new Map<string, number>();
  for (const r of allRows) {
    const month = r.date.slice(0, 7);
    monthCash.set(month, (monthCash.get(month) ?? 0) + cash(r));
  }

  const map = new Map<string, number>();
  for (const r of allRows) {
    const month = r.date.slice(0, 7);
    const tierHit = (monthCash.get(month) ?? 0) > 100_000;
    const rateOrganic = tierHit ? 0.35 : 0.175;
    const ratePaid = tierHit ? 0.45 : 0.225;
    const { paid: payoutPaid, organic: payoutOrganic } = sumSalesTeamPayout([r]);
    const organicProfit = r.ltCashOrganic + r.htCashOrganic - payoutOrganic;
    const paidProfit = r.ltCashPaid + r.htCashPaid - r.adSpend - payoutPaid;
    map.set(r.date, rateOrganic * organicProfit + ratePaid * paidProfit);
  }
  return map;
}

/** `allRows` unfiltered (see above); only rows inside `range` are summed into the total. */
export function ecomSimAgencyProfit(allRows: DailyOfferRow[], range: ResolvedRange): number {
  let total = 0;
  for (const [date, value] of ecomSimAgencyProfitByDay(allRows)) {
    if (isDateInRange(date, range)) total += value;
  }
  return total;
}

function sumMapValues(map: Map<string, number>): number {
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}
