import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";

export const revalidate = 60;

/**
 * Placeholder data — no Airtable base wired up yet for this section.
 * Swap this out for real reads once the source is confirmed.
 */
export async function GET(request: NextRequest) {
  parseRangeFromRequest(request);

  return Response.json({
    sales: 0,
    adSpend: 0,
    totalCashCollected: 0,
    pickupRate: null,
    pickups: 0,
    costPerAcquisition: null,
    leadToCloseRate: null,
  });
}
