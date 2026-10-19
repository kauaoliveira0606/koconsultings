import {
  getBookings,
  getConnectedCalls,
  getMarketingDailyMetrics,
  getMasterclassRegistrants,
} from "@/lib/airtable/tables";
import { easternDateString } from "@/lib/date-range";
import { safeDivide } from "@/lib/metrics";
import { webinarBreakdown } from "@/lib/webinar-breakdown";
import { webinarSourceRows } from "@/lib/webinar-source-funnel";
import { WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";

export const revalidate = 60;

export async function GET() {
  const [marketing, registrants, bookings, calls] = await Promise.all([
    getMarketingDailyMetrics(),
    getMasterclassRegistrants(),
    getBookings(),
    getConnectedCalls(),
  ]);
  const today = easternDateString();
  // Calls booked per webinar = its real Calendly masterclass bookings (user, 2026-10-19).
  const booked = new Map(
    webinarSourceRows(WEBINAR_SCHEDULE.bronson, marketing, registrants, bookings, calls, today)
      .filter((w) => w.status === "done")
      .map((w) => [w.date, w.total.booked]),
  );
  const webinars = webinarBreakdown(marketing, today, WEBINAR_SCHEDULE.bronson).map((w) => {
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
