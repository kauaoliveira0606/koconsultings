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
  cashCollectedLowTicketOrganic: number | null;
  cashCollectedHighTicket: number | null;
  cashCollectedHighTicketPaid: number | null;
  cashCollectedHighTicketOrganic: number | null;
  adSpendMeta: number | null;
};

/**
 * Everything here comes straight from the Marketing Daily Metrics table —
 * no EOD Closer / Affiliate EOD blending, per the client. Different
 * offers' teams fill this form in differently: Bronson types an explicit
 * Paid figure AND an explicit Organic figure and never touches the Total
 * field; Aval/Ecom Simulation type the Total and only occasionally split
 * out Paid. Deriving Organic as (Total − Paid) — as this used to do —
 * silently zeroed out Bronson's real organic cash every single day,
 * since its Total was always blank.
 *
 * So Paid is trusted as typed, and Organic is whichever is bigger: the
 * explicit Organic figure, or (Total − Paid) — covering an offer that
 * only ever fills in Total. This way neither a missing Total nor a
 * missing explicit Organic field can make real cash disappear. Anything
 * before `AGENCY_DATA_START` is dropped entirely — August and earlier is
 * out of scope for this rollup.
 */
export function buildDailyOfferRows(marketing: MarketingRowLike[]): DailyOfferRow[] {
  marketing = marketing.filter((r) => r.date !== null && r.date >= AGENCY_DATA_START);
  const ltTotalByDay = sumByDate(marketing, (r) => r.date, (r) => r.cashCollectedLowTicket);
  const ltPaidByDay = sumByDate(marketing, (r) => r.date, (r) => r.cashCollectedLowTicketPaid);
  const ltOrganicByDay = sumByDate(
    marketing,
    (r) => r.date,
    (r) => r.cashCollectedLowTicketOrganic
  );
  const htTotalByDay = sumByDate(marketing, (r) => r.date, (r) => r.cashCollectedHighTicket);
  const htPaidByDay = sumByDate(marketing, (r) => r.date, (r) => r.cashCollectedHighTicketPaid);
  const htOrganicByDay = sumByDate(
    marketing,
    (r) => r.date,
    (r) => r.cashCollectedHighTicketOrganic
  );
  const adSpendByDay = sumByDate(marketing, (r) => r.date, (r) => r.adSpendMeta);

  const dates = new Set<string>([
    ...ltTotalByDay.keys(),
    ...ltPaidByDay.keys(),
    ...ltOrganicByDay.keys(),
    ...htTotalByDay.keys(),
    ...htPaidByDay.keys(),
    ...htOrganicByDay.keys(),
    ...adSpendByDay.keys(),
  ]);

  const rows: DailyOfferRow[] = [];
  for (const date of dates) {
    const ltPaid = ltPaidByDay.get(date) ?? 0;
    const ltImpliedOrganic = Math.max(0, (ltTotalByDay.get(date) ?? 0) - ltPaid);
    const ltOrganic = Math.max(ltOrganicByDay.get(date) ?? 0, ltImpliedOrganic);
    const htPaid = htPaidByDay.get(date) ?? 0;
    const htImpliedOrganic = Math.max(0, (htTotalByDay.get(date) ?? 0) - htPaid);
    const htOrganic = Math.max(htOrganicByDay.get(date) ?? 0, htImpliedOrganic);
    rows.push({
      date,
      ltCashPaid: ltPaid,
      ltCashOrganic: ltOrganic,
      htCashPaid: htPaid,
      htCashOrganic: htOrganic,
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

/** Generic client P&L per day, same shape as every offer's own "Net Cash" stat. */
export function profitByDay(rows: DailyOfferRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const { paid, organic } = sumSalesTeamPayout([r]);
    map.set(r.date, cash(r) - r.adSpend - (paid + organic));
  }
  return map;
}

export function profit(rows: DailyOfferRow[]): number {
  return sumMapValues(profitByDay(rows));
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

/** Aval: 11.5% of (cash minus ad spend) — no sales team deduction — per day. */
export function avalAgencyProfitByDay(rows: DailyOfferRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.date, 0.115 * (cash(r) - r.adSpend));
  }
  return map;
}

export function avalAgencyProfit(rows: DailyOfferRow[]): number {
  return sumMapValues(avalAgencyProfitByDay(rows));
}

/**
 * Andy (Ecom Simulation): 17.5% organic / 22.5% paid, doubling to 35%/45%
 * the moment that CALENDAR MONTH's running (organic + paid) cash hits
 * $100k — from that point on only, per the client. Cash before the line
 * stays at the lower tier; on the day that crosses it, the day's profit is
 * split pro rata by how much of its cash landed below vs above $100k.
 * `allRows` must be unfiltered by date range (every row this offer has
 * ever logged) so the running month total is right even when only a
 * narrower slice of it is being summed.
 */
const ECOM_SIM_TIER_THRESHOLD = 100_000;

export function ecomSimAgencyProfitByDay(allRows: DailyOfferRow[]): Map<string, number> {
  const sorted = [...allRows].sort((a, b) => a.date.localeCompare(b.date));
  const runningMonthCash = new Map<string, number>();

  const map = new Map<string, number>();
  for (const r of sorted) {
    const month = r.date.slice(0, 7);
    const before = runningMonthCash.get(month) ?? 0;
    const dayCash = cash(r);
    const after = before + dayCash;
    runningMonthCash.set(month, after);

    // Share of this day's cash that sits at or above the $100k line.
    let highShare: number;
    if (before >= ECOM_SIM_TIER_THRESHOLD) highShare = 1;
    else if (after <= ECOM_SIM_TIER_THRESHOLD || dayCash <= 0) highShare = 0;
    else highShare = (after - ECOM_SIM_TIER_THRESHOLD) / dayCash;

    const rateOrganic = 0.175 * (1 - highShare) + 0.35 * highShare;
    const ratePaid = 0.225 * (1 - highShare) + 0.45 * highShare;
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
