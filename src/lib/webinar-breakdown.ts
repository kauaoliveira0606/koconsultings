import type { MarketingDailyMetricRow } from "@/lib/airtable/tables";
import { addDaysToDateString } from "@/lib/date-range";
import { average, safeDivide, sum, webinarCallsBooked, webinarMoney } from "@/lib/metrics";

/**
 * One row per webinar. A webinar is a date with a post-webinar card on the
 * Marketing Daily Metrics form (any of the live fields filled). Its daily
 * numbers are every form day after the previous webinar, up to and including
 * the webinar date. Days after the last webinar make up the next one, shown
 * as in progress until its card comes in.
 */
export type WebinarBreakdownRow = {
  /** Webinar date, or null for the one still in progress. */
  date: string | null;
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

const hasDailyWebinarData = (r: MarketingDailyMetricRow) =>
  [r.webinarOptInsPaid, r.webinarOptInsOrganic, r.vipPurchasesPaid, r.vipPurchasesOrganic].some((v) => v !== null);

const add = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));

function summarize(
  date: string | null,
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

/** Newest webinar first; the in-progress one (if it has any data) on top. */
export function webinarBreakdown(rows: MarketingDailyMetricRow[], today: string): WebinarBreakdownRow[] {
  const dated = rows
    .filter((r): r is MarketingDailyMetricRow & { date: string } => r.date !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const firstDaily = dated.find(hasDailyWebinarData)?.date;
  const cards = dated.filter(hasCard);
  if (!firstDaily && cards.length === 0) return [];

  const out: WebinarBreakdownRow[] = [];
  let start = [firstDaily, cards[0]?.date].filter((d): d is string => !!d).sort()[0];
  for (const card of cards) {
    const days = dated.filter((r) => r.date >= start && r.date <= card.date);
    out.push(summarize(card.date, start, card.date, days, card));
    start = addDaysToDateString(card.date, 1);
  }
  const rest = dated.filter((r) => r.date >= start && r.date <= today);
  if (rest.some(hasDailyWebinarData)) out.push(summarize(null, start, today, rest, undefined));
  return out.reverse();
}
