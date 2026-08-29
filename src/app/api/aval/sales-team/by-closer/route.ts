import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getAvalEodCloser } from "@/lib/airtable/tables-aval";
import { parseDurationMinutes } from "@/lib/airtable/parse";
import { sum } from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const rows = await getAvalEodCloser();
  const inRange = rows.filter((r) => isDateInRange(r.date, range));

  const byCloser = new Map<string, typeof inRange>();
  for (const row of inRange) {
    const closer = row.closerName ?? "Unknown";
    if (!byCloser.has(closer)) byCloser.set(closer, []);
    byCloser.get(closer)!.push(row);
  }

  const closers = Array.from(byCloser.entries()).map(([closer, closerRows]) => ({
    closer,
    callsBooked: sum(closerRows.map((r) => r.callsBooked)),
    callsShowed: sum(closerRows.map((r) => r.callsShowed)),
    dealsClosed: sum(closerRows.map((r) => r.dealsClosed)),
    cashCollected: sum(closerRows.map((r) => r.totalCashCollected)),
    totalTalkTimeMinutes: sum(closerRows.map((r) => parseDurationMinutes(r.totalTalkTimeRaw))),
  }));

  closers.sort((a, b) => (b.cashCollected ?? 0) - (a.cashCollected ?? 0));

  return Response.json({ closers });
}
