import type { NextRequest } from "next/server";
import { getConnectedCalls, getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { isOrganicSource, isPaidSource } from "@/lib/airtable/lead-source-lookup";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { safeDivide, webinarTotals } from "@/lib/metrics";
import { webinarRows, webinarStartDate } from "@/lib/webinar-breakdown";
import { WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";

export const revalidate = 60;

/**
 * First Eastern day the Connected Calls collector reads the "masterclass paid" /
 * "masterclass organic" GHL tags (switched over 2026-10-19; its 72 hour look-back
 * covers Oct 17 on). Earlier calls to masterclass registrants were never tagged.
 */
export const MASTERCLASS_CONNECTION_START = "2026-10-17";

/** Webinar tab: the funnel totals for the selected range, from the form only. */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const [marketing, connected] = await Promise.all([getMarketingDailyMetrics(), getConnectedCalls()]);
  // Only promo days and webinar days of the webinars run, so ad spend from
  // older funnels and break days doesn't land on cost per lead / call.
  const start = webinarStartDate(marketing, WEBINAR_SCHEDULE.bronson);
  const days = webinarRows(marketing, WEBINAR_SCHEDULE.bronson).filter((r) => isDateInRange(r.date, range));

  // Connection rate by source: 1+ minute calls to masterclass registrants (GHL tag)
  // ÷ the form's webinar opt-ins, both counted from the day the tags were read.
  const tracked = (date: string | null) =>
    !!date && date >= MASTERCLASS_CONNECTION_START && isDateInRange(date, range);
  let optInsPaid = 0;
  let optInsOrganic = 0;
  for (const r of days) {
    if (!tracked(r.date)) continue;
    optInsPaid += r.webinarOptInsPaid ?? 0;
    optInsOrganic += r.webinarOptInsOrganic ?? 0;
  }
  // One row per lead per day, so a row count is a distinct-lead-per-day count.
  let connectedPaid = 0;
  let connectedOrganic = 0;
  for (const c of connected) {
    if (!tracked(c.date)) continue;
    if (isPaidSource(c.source)) connectedPaid += 1;
    else if (isOrganicSource(c.source)) connectedOrganic += 1;
  }

  return Response.json({
    ...webinarTotals(days),
    startDate: start,
    connection: {
      trackingStart: MASTERCLASS_CONNECTION_START,
      paid: { optIns: optInsPaid, connected: connectedPaid, rate: safeDivide(connectedPaid, optInsPaid || null) },
      organic: { optIns: optInsOrganic, connected: connectedOrganic, rate: safeDivide(connectedOrganic, optInsOrganic || null) },
    },
  });
}
