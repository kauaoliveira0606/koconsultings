import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { getSalesByAd } from "@/lib/sales-attribution";

export const dynamic = "force-dynamic";

/** Every sale in the range with the ad it came from (Cortana, hourly) and the customer (Post Call Note). */
export async function GET(request: NextRequest) {
  return Response.json({ sales: await getSalesByAd(parseRangeFromRequest(request)) });
}
