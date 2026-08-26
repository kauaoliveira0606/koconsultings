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

export { safeDivide };
