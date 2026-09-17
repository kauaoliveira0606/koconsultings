import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getLeaderboard } from "@/lib/airtable/tables-ecom-simulation";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const rows = await getLeaderboard();

  const inRange = rows
    .filter((r) => isDateInRange(r.lastUpdated?.slice(0, 10) ?? null, range))
    .sort((a, b) => (b.entries ?? 0) - (a.entries ?? 0));

  return Response.json({ rows: inRange });
}
