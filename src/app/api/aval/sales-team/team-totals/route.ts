import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getAvalAffiliateEod } from "@/lib/airtable/tables-aval";
import { parseDurationMinutes } from "@/lib/airtable/parse";
import { pickupRate, sum } from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const rows = await getAvalAffiliateEod();
  const inRange = rows.filter((r) => isDateInRange(r.date, range));

  const outboundDials = sum(inRange.map((r) => r.outboundDials));
  const pickups = sum(inRange.map((r) => r.pickups));
  const cashCollected = sum([
    sum(inRange.map((r) => r.cashCollectedAffiliate)),
    sum(inRange.map((r) => r.cashCollectedHighTicket)),
  ]);

  return Response.json({
    outboundDials,
    pickups,
    pickupRate: pickupRate(pickups, outboundDials),
    softwarePitched: sum(inRange.map((r) => r.softwarePitched)),
    totalSales: sum(inRange.map((r) => r.softwareClosed)),
    cashCollected,
    highTicketCallsPitched: sum(inRange.map((r) => r.highTicketCallsPitched)),
    newHighTicketCallsBooked: sum(inRange.map((r) => r.newHighTicketCallsBooked)),
    totalTalkTimeMinutes: sum(inRange.map((r) => parseDurationMinutes(r.totalTalkTimeRaw))),
  });
}
