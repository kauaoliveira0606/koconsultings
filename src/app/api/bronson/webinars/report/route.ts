import {
  getBookings,
  getBronsonAffiliateEod,
  getConnectedCalls,
  getMarketingDailyMetrics,
  getPostCallNotes,
} from "@/lib/airtable/tables";
import { bronsonRegistrants } from "@/lib/bronson-webinar-funnel";
import { easternDateString } from "@/lib/date-range";
import { webinarReports } from "@/lib/webinar-report";
import { webinarDaily, webinarSourceRows } from "@/lib/webinar-source-funnel";
import { PITCH_AT_SECONDS, WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";

export const revalidate = 60;

/** Webinars tab, Bronson: one report per webinar, newest first. */
export async function GET() {
  const today = easternDateString();
  const [marketing, eod, registrants, bookings, calls, notes] = await Promise.all([
    getMarketingDailyMetrics(),
    getBronsonAffiliateEod(),
    bronsonRegistrants(today),
    getBookings(),
    getConnectedCalls(),
    getPostCallNotes(),
  ]);
  const rows = webinarSourceRows(WEBINAR_SCHEDULE.bronson, marketing, registrants, bookings, calls, notes, today, PITCH_AT_SECONDS.bronson);
  return Response.json({
    webinars: webinarReports(rows, marketing, eod, today),
    daily: webinarDaily(WEBINAR_SCHEDULE.bronson, marketing, bookings, notes, today),
  });
}
