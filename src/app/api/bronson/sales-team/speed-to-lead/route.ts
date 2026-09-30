import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange, toEasternDateOnly, type ResolvedRange } from "@/lib/date-range";
import { getSpeedToLead, type SpeedToLeadRow } from "@/lib/airtable/tables";
import {
  applyWorkingHours,
  avgSpeedToLead,
  dedupeByPhone,
  leadsCalledSummary,
  medianSpeedToLead,
  touchPointSummary,
} from "@/lib/sales-team-metrics";

export const revalidate = 60;

/**
 * Speed to Lead v2 (n8n writes it from GHL every 10 min): funnel opt-ins and
 * the first outbound call a real rep placed after the lead came in. Same
 * person across duplicate contacts counts once. Time to call only counts
 * working hours (9am–11pm ET), so an overnight opt-in's clock starts at 9am.
 */
function summarize(rows: SpeedToLeadRow[], range: ResolvedRange) {
  const inRange = applyWorkingHours(dedupeByPhone(rows))
    .filter((r) => isDateInRange(toEasternDateOnly(r.createdAt), range))
    // newest opt-in first
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return {
    avgSpeedToLead: avgSpeedToLead(inRange),
    medianSpeedToLead: medianSpeedToLead(inRange),
    leadsCalled: leadsCalledSummary(inRange),
    touchPoints: touchPointSummary(inRange),
    leads: inRange,
  };
}

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  return Response.json(summarize(await getSpeedToLead(), range));
}
