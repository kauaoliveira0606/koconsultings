import {
  getBookings,
  getBronsonAffiliateEod,
  getConnectedCalls,
  getMarketingDailyMetrics,
  getMasterclassRegistrants,
  getPostCallNotes,
} from "@/lib/airtable/tables";
import { easternDateString } from "@/lib/date-range";
import { webinarReports } from "@/lib/webinar-report";
import { webinarSourceRows } from "@/lib/webinar-source-funnel";
import { WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";

export const revalidate = 60;

/** Webinars tab, Bronson: one report per webinar, newest first. */
export async function GET() {
  const today = easternDateString();
  const [marketing, eod, registrants, bookings, calls, notes] = await Promise.all([
    getMarketingDailyMetrics(),
    getBronsonAffiliateEod(),
    getMasterclassRegistrants(),
    getBookings(),
    getConnectedCalls(),
    getPostCallNotes(),
  ]);
  const rows = webinarSourceRows(WEBINAR_SCHEDULE.bronson, marketing, registrants, bookings, calls, notes, today);
  return Response.json({ webinars: webinarReports(rows, marketing, eod, today) });
}
