import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getAffiliatePcn } from "@/lib/airtable/tables-ecom-simulation";
import { sum } from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const rows = await getAffiliatePcn();
  const inRange = rows.filter((r) => isDateInRange(r.date, range));

  const byDay = new Map<string, number>();
  for (const row of inRange) {
    if (!row.date || row.cpaCash === null) continue;
    byDay.set(row.date, (byDay.get(row.date) ?? 0) + row.cpaCash);
  }
  const totalCpaByDay = Array.from(byDay.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return Response.json({
    totalCpaCollected: sum(inRange.map((r) => r.cpaCash)),
    totalCpaByDay,
    records: inRange,
  });
}
