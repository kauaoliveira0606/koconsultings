import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange, toEasternDateOnly, type ResolvedRange } from "@/lib/date-range";
import { getSpeedToLead, type SpeedToLeadRow } from "@/lib/airtable/tables";
import { dedupeByPhone, leadsCalledSummary, medianSpeedToLead } from "@/lib/sales-team-metrics";

export const revalidate = 60;

/**
 * Speed to Lead v2 (n8n writes it from GHL every 10 min): funnel opt-ins and
 * the first outbound call a real rep placed after the lead came in. Same
 * person across duplicate contacts counts once. Median, not average, so one
 * lead nobody called for days can't swamp the number.
 */
function summarize(rows: SpeedToLeadRow[], range: ResolvedRange) {
  const inRange = dedupeByPhone(rows)
    .filter((r) => isDateInRange(toEasternDateOnly(r.createdAt), range))
    // newest opt-in first
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return {
    medianSpeedToLead: medianSpeedToLead(inRange),
    leadsCalled: leadsCalledSummary(inRange),
    leads: inRange,
  };
}

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  return Response.json(summarize(await getSpeedToLead(), range));
}
