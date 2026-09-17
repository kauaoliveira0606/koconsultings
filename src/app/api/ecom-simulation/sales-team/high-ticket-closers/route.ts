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

  // Post Call Note has no closer-identity field of its own (only "Setters
  // Full Name" — the setter who booked the call, not who took it), so
  // pitched/closed can only be attributed to a specific closer on days
  // exactly one closer logged an EOD Closer entry. Ambiguous days (more
  // than one closer active, or none) fall into "Unknown" rather than
  // guessing.
  const closerNamesByDate = new Map<string, Set<string>>();
  for (const row of inRangeEod) {
    if (!row.date) continue;
    if (!closerNamesByDate.has(row.date)) closerNamesByDate.set(row.date, new Set());
    closerNamesByDate.get(row.date)!.add(row.closerName ?? "Unknown");
  }
  const pitchedByCloser = new Map<string, number>();
  const closedByCloser = new Map<string, number>();
  for (const r of inRangePcn) {
    if (!r.date) continue;
    const names = closerNamesByDate.get(r.date);
    const attributeTo = names && names.size === 1 ? [...names][0] : "Unknown";
    if (wasPitched(r)) pitchedByCloser.set(attributeTo, (pitchedByCloser.get(attributeTo) ?? 0) + 1);
    if (wasClosed(r)) closedByCloser.set(attributeTo, (closedByCloser.get(attributeTo) ?? 0) + 1);
  }

  const closers = Array.from(byCloser.entries())
    .map(([closer, rows]) => {
      const callsBooked = sum(rows.map((r) => r.callsBooked));
      const cashCollected = sum(rows.map((r) => r.cashCollectedHighTicket));
      const closerPitched = pitchedByCloser.get(closer) ?? 0;
      const closerClosed = closedByCloser.get(closer) ?? 0;
      return {
        closer,
        callsBooked,
        callsShowed: sum(rows.map((r) => r.callsShowed)),
        dealsClosed: sum(rows.map((r) => r.dealsClosed)),
        cashCollected,
        pitched: closerPitched,
        closed: closerClosed,
        closeRate: safeDivide(closerClosed, closerPitched || null),
        collectedPerBookedCall: safeDivide(cashCollected, callsBooked || null),
      };
    })
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
