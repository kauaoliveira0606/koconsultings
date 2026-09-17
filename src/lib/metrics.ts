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

export { safeDivide };
