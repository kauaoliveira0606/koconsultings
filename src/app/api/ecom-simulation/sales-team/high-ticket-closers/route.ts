import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import {
  getEodCloser,
  getPostCallNotes,
  wasPitched,
  wasClosed,
} from "@/lib/airtable/tables-ecom-simulation";
import { safeDivide, sum } from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [eodCloser, postCallNotes] = await Promise.all([getEodCloser(), getPostCallNotes()]);

  const inRangeEod = eodCloser.filter((r) => isDateInRange(r.date, range));
  const inRangePcn = postCallNotes.filter((r) => isDateInRange(r.date, range));

  const pitched = inRangePcn.filter(wasPitched).length;
  const closed = inRangePcn.filter(wasClosed).length;

  const byCloser = new Map<string, typeof inRangeEod>();
  for (const row of inRangeEod) {
    const closer = row.closerName ?? "Unknown";
    if (!byCloser.has(closer)) byCloser.set(closer, []);
    byCloser.get(closer)!.push(row);
  }

  const closers = Array.from(byCloser.entries())
    .map(([closer, rows]) => ({
      closer,
      callsBooked: sum(rows.map((r) => r.callsBooked)),
      callsShowed: sum(rows.map((r) => r.callsShowed)),
      dealsClosed: sum(rows.map((r) => r.dealsClosed)),
      cashCollected: sum(rows.map((r) => r.cashCollectedHighTicket)),
    }))
    .sort((a, b) => (b.cashCollected ?? 0) - (a.cashCollected ?? 0));

  return Response.json({
    callsBooked: sum(inRangeEod.map((r) => r.callsBooked)),
    callsShowed: sum(inRangeEod.map((r) => r.callsShowed)),
    offersMade: sum(inRangeEod.map((r) => r.offersMade)),
    dealsClosed: sum(inRangeEod.map((r) => r.dealsClosed)),
    cashCollected: sum(inRangeEod.map((r) => r.cashCollectedHighTicket)),
    totalRevenue: sum(inRangeEod.map((r) => r.revenueHighTicket)),
    pitched,
    closed,
    closeRate: safeDivide(closed, pitched || null),
    closers,
    records: inRangePcn,
  });
}
