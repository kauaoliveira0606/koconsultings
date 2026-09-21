import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange, toEasternDateOnly } from "@/lib/date-range";
import { getLeads, getConnectedCalls } from "@/lib/airtable/tables-ecom-simulation";
import { isPaidSource, isOrganicSource } from "@/lib/airtable/lead-source-lookup";
import { safeDivide } from "@/lib/metrics";

export const revalidate = 60;

/**
 * First Eastern day the "Paid" / "Organic" values in the Close lead "Tags" field were being applied to new
 * opt-ins. Pickups are matched to Paid/Organic by that tag, so anything before
 * this date has opt-ins but no way to attribute a pickup — counting those days
 * would only drag both rates toward 0%.
 */
export const CONNECTION_TRACKING_START = "2026-09-21";

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const inTracked = (date: string | null) =>
    !!date && date >= CONNECTION_TRACKING_START && isDateInRange(date, range);

  const [leads, connected] = await Promise.all([getLeads(), getConnectedCalls()]);

  let optInsPaid = 0;
  let optInsOrganic = 0;
  for (const l of leads) {
    const d = toEasternDateOnly(l.createdAt);
    if (!inTracked(d)) continue;
    if (isPaidSource(l.source)) optInsPaid += 1;
    else if (isOrganicSource(l.source)) optInsOrganic += 1;
  }

  // One row per lead per day, so a row count is a distinct-lead-per-day count.
  let connectedPaid = 0;
  let connectedOrganic = 0;
  for (const c of connected) {
    if (!inTracked(c.date)) continue;
    if (isPaidSource(c.source)) connectedPaid += 1;
    else if (isOrganicSource(c.source)) connectedOrganic += 1;
  }

  return Response.json({
    trackingStart: CONNECTION_TRACKING_START,
    paid: {
      optIns: optInsPaid,
      connected: connectedPaid,
      rate: safeDivide(connectedPaid, optInsPaid || null),
    },
    organic: {
      optIns: optInsOrganic,
      connected: connectedOrganic,
      rate: safeDivide(connectedOrganic, optInsOrganic || null),
    },
  });
}
