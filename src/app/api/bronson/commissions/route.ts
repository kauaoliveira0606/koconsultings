import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { getBronsonCommissions } from "@/lib/airtable/commissions";

// Clawbacks are written from the tab and must show immediately; the big
// Airtable tables are still cached for 60s inside airtableListAll.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  return Response.json(await getBronsonCommissions(range));
}
