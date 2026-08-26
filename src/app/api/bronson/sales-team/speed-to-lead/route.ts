import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getSpeedToLead } from "@/lib/airtable/tables";
import { avgSpeedToLead, leadsCalledSummary, medianSpeedToLead } from "@/lib/sales-team-metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const rows = await getSpeedToLead();
  const inRange = rows.filter((r) => isDateInRange(r.createdAt?.slice(0, 10) ?? null, range));

  return Response.json({
    avgSpeedToLead: avgSpeedToLead(inRange),
    medianSpeedToLead: medianSpeedToLead(inRange),
    leadsCalled: leadsCalledSummary(inRange),
    leads: inRange,
  });
}
