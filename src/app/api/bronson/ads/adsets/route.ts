import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { aggregateEntities, getAdsDaily, getAdsRange } from "@/lib/ads-cortana";

export const revalidate = 60;

/**
 * Ad set level. Cortana calls ad sets "medium" (groupBy=medium returns Meta ad
 * set names + ids), synced hourly by n8n iXJRFVgLJ12gGZxd as Level = adset.
 */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const preset = request.nextUrl.searchParams.get("preset") ?? "all_time";
  const [daily, rangeRows] = await Promise.all([getAdsDaily(), getAdsRange(preset)]);
  const rows = daily.filter((r) => r.level === "adset" && isDateInRange(r.date, range));
  // Totals from Cortana's deduplicated range numbers when synced for this preset.
  const totals = rangeRows ? rangeRows.filter((r) => r.level === "adset") : rows;
  const dates = [...new Set(rows.map((r) => r.date))].sort().reverse();
  return Response.json({
    ok: true,
    adsets: aggregateEntities(totals),
    byDay: dates.map((date) => ({ date, adsets: aggregateEntities(rows.filter((r) => r.date === date)) })),
  });
}
