import { getAvalMarketingDailyMetrics } from "@/lib/airtable/tables-aval";
import { avalWebinarSourceRows } from "@/lib/aval-webinar-funnel";
import { easternDateString } from "@/lib/date-range";
import { safeDivide } from "@/lib/metrics";
import { webinarBreakdown } from "@/lib/webinar-breakdown";
import { WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";

export const revalidate = 60;

export async function GET() {
  const today = easternDateString();
  const [marketing, booked] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    avalWebinarSourceRows(today)
      .then((rows) => new Map<string, number | null>(rows.filter((w) => w.status === "done").map((w) => [w.date, w.total.booked])))
      .catch((err) => {
        console.error("Aval webinar funnel", err);
        // Held webinars show blank, never the estimate.
        return new Map<string, number | null>(WEBINAR_SCHEDULE.aval.filter((r) => r.date < today).map((r) => [r.date, null]));
      }),
  ]);
  // Calls booked per webinar = its real Calendly masterclass bookings (user, 2026-10-19).
  const webinars = webinarBreakdown(marketing, today, WEBINAR_SCHEDULE.aval).map((w) => {
    const n = booked.get(w.date);
    if (n === undefined) return w;
    return {
      ...w,
      callsBooked: n,
      costPerBookedCall: n !== null && (w.adSpend ?? 0) > 0 ? safeDivide(w.adSpend, n || null) : null,
    };
  });
  return Response.json({ webinars });
}
