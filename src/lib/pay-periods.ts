import { easternDateString } from "./date-range";

/**
 * Bronson sales-team pay periods. August 2026 was paid as Aug 1-21 and
 * Aug 22-31; from September 2026 on it is twice a month (1st-15th, 16th-end).
 */

export type PayPeriod = {
  key: string;
  label: string;
  start: string; // inclusive ISO date
  end: string; // inclusive ISO date
  kind: "period" | "month";
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const FIRST_YEAR = 2026;
const FIRST_MONTH0 = 7; // August 2026
const AUGUST_2026_SPLIT_DAY = 21;

const pad = (n: number) => String(n).padStart(2, "0");
const lastDayOfMonth = (year: number, month0: number) =>
  new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

/** Every pay period and whole month up to today (Eastern), newest first. */
export function buildPayPeriods(today: string = easternDateString()): PayPeriod[] {
  const periods: PayPeriod[] = [];
  const endYear = Number(today.slice(0, 4));
  const endMonth0 = Number(today.slice(5, 7)) - 1;

  let y = FIRST_YEAR;
  let m = FIRST_MONTH0;
  while (y < endYear || (y === endYear && m <= endMonth0)) {
    const ym = `${y}-${pad(m + 1)}`;
    const last = lastDayOfMonth(y, m);
    const split = y === 2026 && m === 7 ? AUGUST_2026_SPLIT_DAY : 15;
    const halves: [number, number][] = [
      [1, split],
      [split + 1, last],
    ];
    for (const [from, to] of halves) {
      const start = `${ym}-${pad(from)}`;
      if (start > today) continue;
      periods.push({
        key: start,
        label: `${MONTHS[m]} ${from} - ${to}, ${y}`,
        start,
        end: `${ym}-${pad(to)}`,
        kind: "period",
      });
    }
    periods.push({
      key: ym,
      label: `${MONTHS[m]} ${y} (full month)`,
      start: `${ym}-01`,
      end: `${ym}-${pad(last)}`,
      kind: "month",
    });
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return periods.reverse();
}
