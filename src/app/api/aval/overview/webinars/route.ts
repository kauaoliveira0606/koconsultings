import { getAvalMarketingDailyMetrics } from "@/lib/airtable/tables-aval";
import { avalWebinarBookings } from "@/lib/aval-webinar-bookings";
import { easternDateString } from "@/lib/date-range";
import { safeDivide } from "@/lib/metrics";
import { webinarBreakdown } from "@/lib/webinar-breakdown";
import { WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";

export const revalidate = 60;

export async function GET() {
  const today = easternDateString();
  const [marketing, booked] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    avalWebinarBookings(WEBINAR_SCHEDULE.aval, today),
  ]);
  // Calls booked per webinar = its real Calendly masterclass bookings (user, 2026-10-19).
  const webinars = webinarBreakdown(marketing, today, WEBINAR_SCHEDULE.aval).map((w) => {
    const n = booked.get(w.date);
    if (n === undefined) return w;
    return {
      ...w,
      callsBooked: n,
      costPerBookedCall: (w.adSpend ?? 0) > 0 ? safeDivide(w.adSpend, n || null) : null,
    };
  });
  return Response.json({ webinars });
}
