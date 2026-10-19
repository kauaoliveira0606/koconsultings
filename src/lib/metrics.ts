/**
 * Pure, null-safe derived-metric calculations shared across the dashboard.
 * Every function takes already-parsed numbers (or nulls) and returns
 * `number | null` — null whenever a numerator/denominator is missing or
 * the denominator is zero, so callers never have to guard against NaN/Infinity.
 */

function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

export function pitchRate(softwarePitched: number | null, pickups: number | null): number | null {
  return safeDivide(softwarePitched, pickups);
}

export function costPerAcquisition(spend: number | null, sales: number | null): number | null {
  return safeDivide(spend, sales);
}

export function leadToCloseRate(sales: number | null, leads: number | null): number | null {
  return safeDivide(sales, leads);
}

export function highTicketPitchRate(htPitched: number | null, sales: number | null): number | null {
  return safeDivide(htPitched, sales);
}

export function upsellBookingRate(htBooked: number | null, htPitched: number | null): number | null {
  return safeDivide(htBooked, htPitched);
}

export function cashCollectedPerOptIn(cashCollected: number | null, optIns: number | null): number | null {
  return safeDivide(cashCollected, optIns);
}

export function averageOrderValue(revenue: number | null, sales: number | null): number | null {
  return safeDivide(revenue, sales);
}

export function pickupRate(pickups: number | null, dials: number | null): number | null {
  return safeDivide(pickups, dials);
}

export function costPerLead(spend: number | null, leads: number | null): number | null {
  return safeDivide(spend, leads);
}

export function roas(cashCollected: number | null, adSpend: number | null): number | null {
  return safeDivide(cashCollected, adSpend);
}

export function sum(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}

export function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return sum(present)! / present.length;
}

/**
 * VSL totals across days. Rates are weighted by volume (play rate by views,
 * engagement by plays) so a thin day, like today's first few visitors, can't
 * swing a whole week the way a plain average of daily rates would.
 */
export function vslTotals(
  rows: {
    vslViews: number | null;
    vslPlays: number | null;
    vslPlayRate: number | null;
    vslEngagementRate: number | null;
  }[]
) {
  let views = 0;
  let plays = 0;
  let playRateViews = 0;
  let engagementWeighted = 0;
  let engagementPlays = 0;
  let any = false;
  for (const r of rows) {
    if (r.vslViews === null) continue;
    any = true;
    views += r.vslViews;
    if (r.vslPlayRate === null) continue;
    const dayPlays = r.vslPlays ?? r.vslViews * r.vslPlayRate;
    plays += dayPlays;
    playRateViews += r.vslViews;
    if (r.vslEngagementRate !== null) {
      engagementWeighted += r.vslEngagementRate * dayPlays;
      engagementPlays += dayPlays;
    }
  }
  return {
    vslViews: any ? views : null,
    vslPlayRate: safeDivide(plays, playRateViews || null),
    vslEngagementRate: safeDivide(engagementWeighted, engagementPlays || null),
  };
}

export function median(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (present.length === 0) return null;
  const mid = Math.floor(present.length / 2);
  return present.length % 2 === 0 ? (present[mid - 1] + present[mid]) / 2 : present[mid];
}

/**
 * Sums a per-day amount (e.g. high-ticket cash) across a set of dates,
 * preferring the first source that has ANY record for a given day — even a
 * $0 one — and only falling through to the next source for days the
 * earlier one is completely silent on. Prevents double-counting when two
 * sources both log the same day, and stops a day with real activity from
 * being invisible just because a later/weaker source (typically a
 * manually-typed form field) never got filled in for it. Same preference
 * order the Weekly Scorecard already uses per-day, applied here to a whole
 * range so Overview totals agree with it.
 */
export function sumPreferringDatedSources(
  dates: Iterable<string>,
  sources: Map<string, number>[]
): number | null {
  let total = 0;
  let any = false;
  for (const date of dates) {
    for (const source of sources) {
      if (source.has(date)) {
        total += source.get(date)!;
        any = true;
        break;
      }
    }
  }
  return any ? total : null;
}

/** Sums a numeric field across rows into a Map keyed by date, skipping rows with no date. */
export function sumByDate<T>(
  rows: T[],
  getDate: (row: T) => string | null,
  getValue: (row: T) => number | null
): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    const date = getDate(row);
    if (!date) continue;
    byDate.set(date, (byDate.get(date) ?? 0) + (getValue(row) ?? 0));
  }
  return byDate;
}

/**
 * High-ticket calls booked / showed / deals closed, per day: the Marketing
 * Daily Metrics form wins on any day it has a value, and the fallback
 * sources (EOD Closer, Affiliate EOD, Post Call Notes, in that order) only
 * fill days the form left blank. Same rule as the Weekly Scorecard, so the
 * two pages always agree.
 */
export function formFirstByDay<F>(
  formRows: F[],
  getDate: (row: F) => string | null,
  pick: (row: F) => number | null,
  fallbacks: Map<string, number>[]
): number | null {
  const withValue = formRows.filter((r) => pick(r) !== null);
  const form = sumByDate(withValue, getDate, pick);
  const dates = new Set<string>(form.keys());
  for (const f of fallbacks) for (const d of f.keys()) dates.add(d);
  return sumPreferringDatedSources(dates, [form, ...fallbacks]);
}

export { safeDivide };

type WebinarDay = {
  webinarOptInsPaid: number | null;
  webinarOptInsOrganic: number | null;
  webinarOptInRate: number | null;
  vipPurchasesPaid: number | null;
  vipPurchasesOrganic: number | null;
  vipCashPaid: number | null;
  vipCashOrganic: number | null;
  hookRate: number | null;
  holdRate: number | null;
  adFrequency: number | null;
  cpm: number | null;
  costPerLinkClick: number | null;
  linkClickThroughRate: number | null;
  adSpendMeta: number | null;
  costPerLeadMeta: number | null;
  landingPageConnectRate: number | null;
  // Post-webinar card (its own form row on the webinar date).
  webinarShowRate: number | null;
  liveAttendees: number | null;
  liveAttendeesAtPitch: number | null;
  retentionRateUntilPitch: number | null;
  webinarBookingRate: number | null;
  cashCollectedHighTicketPaid: number | null;
  cashCollectedHighTicketOrganic: number | null;
};

/** Calls booked off one post-webinar card: attendees at pitch × booking rate. */
export function webinarCallsBooked(r: Pick<WebinarDay, "liveAttendeesAtPitch" | "webinarBookingRate">): number | null {
  return r.liveAttendeesAtPitch === null || r.webinarBookingRate === null ? null : r.liveAttendeesAtPitch * r.webinarBookingRate;
}

/**
 * Cash and ROAS for a set of webinar days: high ticket + VIP from the form
 * (Bronson AI is its own product, not the webinar). ROAS is paid cash ÷ ad
 * spend; cost per booked call is ad spend ÷ calls booked off the webinars.
 */
export function webinarMoney(days: WebinarDay[], adSpend: number | null, callsBooked: number | null) {
  const add = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));
  const htPaid = sum(days.map((r) => r.cashCollectedHighTicketPaid));
  const htOrganic = sum(days.map((r) => r.cashCollectedHighTicketOrganic));
  const vipPaid = sum(days.map((r) => r.vipCashPaid));
  const vipOrganic = sum(days.map((r) => r.vipCashOrganic));
  const paidCash = add(htPaid, vipPaid);
  const organicCash = add(htOrganic, vipOrganic);
  const spending = (adSpend ?? 0) > 0;
  return {
    callsBooked,
    costPerBookedCall: spending ? safeDivide(adSpend, callsBooked || null) : null,
    highTicketCash: add(htPaid, htOrganic),
    highTicketCashPaid: htPaid,
    highTicketCashOrganic: htOrganic,
    webinarCash: add(paidCash, organicCash),
    webinarCashPaid: paidCash,
    webinarCashOrganic: organicCash,
    roasPaid: spending && paidCash !== null ? safeDivide(paidCash, adSpend) : null,
    cashPerBookedCall: safeDivide(add(paidCash, organicCash), callsBooked || null),
  };
}

/**
 * Webinar funnel numbers from the Marketing Daily Metrics form. Counts and
 * cash add up across days; the rates and ad costs the team types in are
 * averaged across the days that have them.
 */
export function webinarTotals(rows: WebinarDay[]) {
  const add = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));
  const optInsPaid = sum(rows.map((r) => r.webinarOptInsPaid));
  const optInsOrganic = sum(rows.map((r) => r.webinarOptInsOrganic));
  const optIns = add(optInsPaid, optInsOrganic);
  const vipPurchasesPaid = sum(rows.map((r) => r.vipPurchasesPaid));
  const vipPurchasesOrganic = sum(rows.map((r) => r.vipPurchasesOrganic));
  const vipPurchases = add(vipPurchasesPaid, vipPurchasesOrganic);
  const vipCashPaid = sum(rows.map((r) => r.vipCashPaid));
  const vipCashOrganic = sum(rows.map((r) => r.vipCashOrganic));
  const adSpend = sum(rows.map((r) => r.adSpendMeta));
  const cards = rows.filter((r) =>
    [r.webinarShowRate, r.liveAttendees, r.liveAttendeesAtPitch, r.retentionRateUntilPitch, r.webinarBookingRate].some(
      (v) => v !== null,
    ),
  );
  return {
    adSpend,
    // Form's typed CPL first; otherwise ad spend ÷ paid webinar opt-ins.
    costPerLeadPaid:
      average(rows.map((r) => r.costPerLeadMeta)) ?? ((adSpend ?? 0) > 0 ? safeDivide(adSpend, optInsPaid || null) : null),
    landingPageConnectRate: average(rows.map((r) => r.landingPageConnectRate)),
    // Post-webinar card: counts add up, rates average across the webinars held.
    webinarsHeld: cards.length,
    showRate: average(cards.map((r) => r.webinarShowRate)),
    liveAttendees: sum(cards.map((r) => r.liveAttendees)),
    liveAttendeesAtPitch: sum(cards.map((r) => r.liveAttendeesAtPitch)),
    retentionRateUntilPitch: average(cards.map((r) => r.retentionRateUntilPitch)),
    bookingRate: average(cards.map((r) => r.webinarBookingRate)),
    ...webinarMoney(rows, adSpend, sum(cards.map(webinarCallsBooked))),
    optInsPaid,
    optInsOrganic,
    optIns,
    optInRate: average(rows.map((r) => r.webinarOptInRate)),
    vipPurchasesPaid,
    vipPurchasesOrganic,
    vipPurchases,
    vipCashPaid,
    vipCashOrganic,
    vipCash: add(vipCashPaid, vipCashOrganic),
    // VIP purchases ÷ webinar opt-ins, each source on its own.
    takeRatePaid: safeDivide(vipPurchasesPaid, optInsPaid),
    takeRateOrganic: safeDivide(vipPurchasesOrganic, optInsOrganic),
    hookRate: average(rows.map((r) => r.hookRate)),
    holdRate: average(rows.map((r) => r.holdRate)),
    adFrequency: average(rows.map((r) => r.adFrequency)),
    cpm: average(rows.map((r) => r.cpm)),
    costPerLinkClick: average(rows.map((r) => r.costPerLinkClick)),
    linkClickThroughRate: average(rows.map((r) => r.linkClickThroughRate)),
  };
}

export type WebinarTotals = ReturnType<typeof webinarTotals>;
