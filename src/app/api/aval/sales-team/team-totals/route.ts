import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getAvalEodDialer, getAvalEodCloser, getAvalFollowUpPayments } from "@/lib/airtable/tables-aval";
import { parseDurationMinutes } from "@/lib/airtable/parse";
import { pickupRate, sum } from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [dialer, closer, followUps] = await Promise.all([
    getAvalEodDialer(),
    getAvalEodCloser(),
    getAvalFollowUpPayments(),
  ]);

  const inRangeDialer = dialer.filter((r) => isDateInRange(r.date, range));
  const inRangeCloser = closer.filter((r) => isDateInRange(r.date, range));
  const inRangeFollowUps = followUps.filter((r) => isDateInRange(r.date, range));

  const outboundDials = sum(inRangeDialer.map((r) => r.outboundDials));
  const pickups = sum(inRangeDialer.map((r) => r.pickups));

  return Response.json({
    outboundDials,
    pickups,
    pickupRate: pickupRate(pickups, outboundDials),
    callsBooked: sum(inRangeCloser.map((r) => r.callsBooked)),
    callsShowed: sum(inRangeCloser.map((r) => r.callsShowed)),
    dealsClosed: sum(inRangeCloser.map((r) => r.dealsClosed)),
    cashCollected: sum(inRangeCloser.map((r) => r.totalCashCollected)),
    totalRevenue: sum(inRangeCloser.map((r) => r.totalRevenue)),
    totalTalkTimeMinutes: sum(inRangeCloser.map((r) => parseDurationMinutes(r.totalTalkTimeRaw))),
    followUpPaymentsCollected: sum(inRangeFollowUps.map((r) => r.cashCollected)),
  });
}
