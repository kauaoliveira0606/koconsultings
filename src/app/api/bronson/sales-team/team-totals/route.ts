import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getEodDialer } from "@/lib/airtable/tables";
import { parseDurationMinutes } from "@/lib/airtable/parse";
import { sum } from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const rows = await getEodDialer();
  const inRange = rows.filter((r) => isDateInRange(r.date, range));

  return Response.json({
    outboundDials: sum(inRange.map((r) => r.outboundDials)),
    pickups: sum(inRange.map((r) => r.pickups)),
    convosOver2Min: sum(inRange.map((r) => r.convosOver2Min)),
    totalTalkTimeMinutes: sum(inRange.map((r) => parseDurationMinutes(r.totalTalkTimeRaw))),
  });
}
