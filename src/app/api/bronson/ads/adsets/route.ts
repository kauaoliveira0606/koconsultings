import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { aggregateEntities, getAdsDaily } from "@/lib/ads-cortana";

export const revalidate = 60;

/**
 * Ad set level. Cortana calls ad sets "medium" (groupBy=medium returns Meta ad
 * set names + ids), synced hourly by n8n iXJRFVgLJ12gGZxd as Level = adset.
 */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const rows = (await getAdsDaily()).filter((r) => r.level === "adset" && isDateInRange(r.date, range));
  const dates = [...new Set(rows.map((r) => r.date))].sort().reverse();
  return Response.json({
    ok: true,
    adsets: aggregateEntities(rows),
    byDay: dates.map((date) => ({ date, adsets: aggregateEntities(rows.filter((r) => r.date === date)) })),
  });
}
