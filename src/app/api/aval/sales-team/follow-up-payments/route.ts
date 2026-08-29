import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getAvalFollowUpPayments } from "@/lib/airtable/tables-aval";
import { sum } from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const rows = await getAvalFollowUpPayments();
  const inRange = rows
    .filter((r) => isDateInRange(r.date, range))
    .sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? 1 : -1));

  return Response.json({
    totalCollected: sum(inRange.map((r) => r.cashCollected)),
    payments: inRange,
  });
}
