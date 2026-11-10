import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { addDaysToDateString, easternDateString } from "@/lib/date-range";
import { aggregateEntities } from "@/lib/ads-cortana";
import { getMetaLevel } from "@/lib/ads-meta";

export const revalidate = 300;

/** Ad set level from Meta (Cortana can't group by ad set): totals and by day for the range. */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const until = range.end ?? easternDateString();
  const since = range.start ?? addDaysToDateString(until, -89);
  const meta = await getMetaLevel("adset", since, until);
  if (!meta.ok) return Response.json({ ok: false, error: meta.error, adsets: [], byDay: [] });
  const dates = [...new Set(meta.rows.map((r) => r.date))].sort().reverse();
  return Response.json({
    ok: true,
    adsets: aggregateEntities(meta.rows),
    byDay: dates.map((date) => ({ date, adsets: aggregateEntities(meta.rows.filter((r) => r.date === date)) })),
  });
}
