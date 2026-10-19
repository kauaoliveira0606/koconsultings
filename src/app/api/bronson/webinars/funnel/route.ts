import type { NextRequest } from "next/server";
import {
  getBookings,
  getConnectedCalls,
  getMarketingDailyMetrics,
  getMasterclassRegistrants,
} from "@/lib/airtable/tables";
import { parseRangeFromRequest } from "@/lib/api-range";
import { easternDateString, isDateInRange } from "@/lib/date-range";
import { sumSourceRows, webinarSourceRows } from "@/lib/webinar-source-funnel";
import { WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";

export const revalidate = 60;

/** Webinars tab, Bronson: the paid vs organic funnel per webinar and for the range. */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const [marketing, registrants, bookings, calls] = await Promise.all([
    getMarketingDailyMetrics(),
    getMasterclassRegistrants(),
    getBookings(),
    getConnectedCalls(),
  ]);
  const webinars = webinarSourceRows(WEBINAR_SCHEDULE.bronson, marketing, registrants, bookings, calls, easternDateString());
  // Range totals use webinars already held, so an upcoming session's sign-ups don't drag its show rate.
  const inRange = webinars.filter((w) => w.status === "done" && isDateInRange(w.date, range));
  return Response.json({ range: sumSourceRows(inRange), webinars });
}
