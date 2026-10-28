import type { MarketingDailyMetricRow } from "@/lib/airtable/tables";
import { average, safeDivide, sum, webinarCallsBooked, webinarMoney } from "@/lib/metrics";
import { chainPromos, type WebinarRun } from "@/lib/webinar-schedule";

/**
 * One row per webinar actually run (or planned), from the offer's schedule in
 * webinar-schedule.ts. Its daily numbers are the form days of its promo
 * period, through the webinar day; the card stats come from the post-webinar
 * card submitted on the webinar date. Break days between webinars count
 * toward none. A card on a date that isn't scheduled still gets a column,
 * with a default 5-day promo.
 */
export type WebinarBreakdownRow = {
  /** 1 for the first webinar run, 2 for the next... */
  number: number;
  /** Webinar date. */
  date: string;
  status: "done" | "promo" | "upcoming";
  hasCard: boolean;
  /** Promo start and the last day counted (webinar day, or today mid-promo). */
  start: string;
  end: string;
  days: number;
  optInsPaid: number | null;
  optInsOrganic: number | null;
  optIns: number | null;
  vipPurchasesPaid: number | null;
  vipPurchasesOrganic: number | null;
  vipPurchases: number | null;
  takeRatePaid: number | null;
  takeRateOrganic: number | null;
  vipCash: number | null;
  adSpend: number | null;
  /** Form's typed CPL averaged over the days; if blank, ad spend ÷ paid opt-ins (same rule as the range card). */
  costPerLeadPaid: number | null;
  // From the post-webinar card.
  showRate: number | null;
  liveAttendees: number | null;
  liveAttendeesAtPitch: number | null;
  retentionRateUntilPitch: number | null;
  bookingRate: number | null;
} & ReturnType<typeof webinarMoney>;

const hasCard = (r: MarketingDailyMetricRow) =>
  [r.webinarShowRate, r.liveAttendees, r.liveAttendeesAtPitch, r.retentionRateUntilPitch, r.webinarBookingRate].some(
    (v) => v !== null,
  );

const add = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));

function summarize(
  number: number,
  status: WebinarBreakdownRow["status"],
  date: string,
  start: string,
  end: string,
  days: MarketingDailyMetricRow[],
  card: MarketingDailyMetricRow | undefined,
): WebinarBreakdownRow {
  const optInsPaid = sum(days.map((r) => r.webinarOptInsPaid));
  const optInsOrganic = sum(days.map((r) => r.webinarOptInsOrganic));
  const vipPurchasesPaid = sum(days.map((r) => r.vipPurchasesPaid));
  const vipPurchasesOrganic = sum(days.map((r) => r.vipPurchasesOrganic));
  const adSpend = sum(days.map((r) => r.adSpendMeta));
  return {
    number,
    status,
    hasCard: !!card,
    date,
    start,
    end,
    days: days.length,
    optInsPaid,
    optInsOrganic,
    optIns: add(optInsPaid, optInsOrganic),
    vipPurchasesPaid,
    vipPurchasesOrganic,
    vipPurchases: add(vipPurchasesPaid, vipPurchasesOrganic),
    takeRatePaid: safeDivide(vipPurchasesPaid, optInsPaid),
    takeRateOrganic: safeDivide(vipPurchasesOrganic, optInsOrganic),
    vipCash: add(sum(days.map((r) => r.vipCashPaid)), sum(days.map((r) => r.vipCashOrganic))),
    adSpend,
    costPerLeadPaid:
      average(days.map((r) => r.costPerLeadMeta)) ?? ((adSpend ?? 0) > 0 ? safeDivide(adSpend, optInsPaid || null) : null),
    showRate: card?.webinarShowRate ?? null,
    liveAttendees: card?.liveAttendees ?? null,
    liveAttendeesAtPitch: card?.liveAttendeesAtPitch ?? null,
    retentionRateUntilPitch: card?.retentionRateUntilPitch ?? null,
    bookingRate: card?.webinarBookingRate ?? null,
    ...webinarMoney(days, adSpend, card ? webinarCallsBooked(card) : null),
  };
}

/** The schedule plus any post-webinar card on an unscheduled date, oldest first. */
function allRuns(rows: MarketingDailyMetricRow[], schedule: WebinarRun[]): WebinarRun[] {
  const scheduled = new Set(schedule.map((r) => r.date));
  const extra = rows
    .filter((r) => r.date && hasCard(r) && !scheduled.has(r.date))
    .map((r) => ({ date: r.date as string }));
  return chainPromos([...schedule, ...extra]);
}

/** First promo day of the first webinar. */
export function webinarStartDate(rows: MarketingDailyMetricRow[], schedule: WebinarRun[]): string | null {
  return allRuns(rows, schedule)[0]?.promoStart ?? null;
}

/** Form days that belong to a webinar (inside a promo period, through the webinar day). */
export function isWebinarDay(date: string | null, runs: WebinarRun[]): boolean {
  return !!date && runs.some((r) => date >= r.promoStart && date <= r.date);
}

/** Every form row that belongs to a webinar run, for the range totals. */
export function webinarRows(rows: MarketingDailyMetricRow[], schedule: WebinarRun[]): MarketingDailyMetricRow[] {
  const runs = allRuns(rows, schedule);
  return rows.filter((r) => isWebinarDay(r.date, runs));
}

/** Newest webinar first, planned ones included. */
export function webinarBreakdown(
  rows: MarketingDailyMetricRow[],
  today: string,
  schedule: WebinarRun[],
): WebinarBreakdownRow[] {
  const dated = rows.filter((r): r is MarketingDailyMetricRow & { date: string } => r.date !== null);
  return allRuns(rows, schedule)
    .map((run, i) => {
      const end = run.date < today ? run.date : today;
      const days = run.promoStart <= today ? dated.filter((r) => r.date >= run.promoStart && r.date <= end) : [];
      const card = dated.find((r) => r.date === run.date && hasCard(r));
      const status = card || run.date < today ? "done" : run.promoStart <= today ? "promo" : "upcoming";
      return summarize(i + 1, status, run.date, run.promoStart, status === "upcoming" ? run.date : end, days, card);
    })
    .reverse();
}
