import type { MarketingDailyMetricRow } from "@/lib/airtable/tables";
import { addDaysToDateString } from "@/lib/date-range";
import { safeDivide, webinarTotals } from "@/lib/metrics";
import type { WebinarSourceRow } from "@/lib/webinar-source-funnel";

type EodRow = { date: string | null; selfBookedToReachOut?: number | null; selfBookedConnected?: number | null };

/**
 * One report per webinar (user, 2026-10-19: per webinar, never a date range):
 * the form's numbers for its promo days (ads, opt-ins, VIP, the post-webinar
 * card) next to the automatic paid / organic funnel, plus the setters' EOD
 * self-booked connection rate over the days its calls were booked.
 */
export type WebinarReport = WebinarSourceRow & {
  form: ReturnType<typeof webinarTotals>;
  /** The days this webinar's calls were booked: webinar day through the day before the next one (or today). */
  bookingWindow: { from: string; to: string } | null;
  eodConnection: { reachOut: number; connected: number; rate: number | null };
};

export function webinarReports(
  rows: WebinarSourceRow[],
  marketing: MarketingDailyMetricRow[],
  eod: EodRow[],
  today: string,
): WebinarReport[] {
  const dates = rows.map((r) => r.date).sort();
  return rows.map((r) => {
    const days = marketing.filter((m) => !!m.date && m.date >= r.promoStart && m.date <= r.date);
    const next = dates.find((d) => d > r.date);
    const bookingWindow =
      r.status === "done" ? { from: r.date, to: next && next <= today ? addDaysToDateString(next, -1) : today } : null;
    let reachOut = 0;
    let connected = 0;
    for (const e of eod) {
      if (!bookingWindow || !e.date || e.date < bookingWindow.from || e.date > bookingWindow.to) continue;
      reachOut += e.selfBookedToReachOut ?? 0;
      connected += e.selfBookedConnected ?? 0;
    }
    return {
      ...r,
      form: webinarTotals(days),
      bookingWindow,
      eodConnection: { reachOut, connected, rate: safeDivide(connected, reachOut || null) },
    };
  });
}
