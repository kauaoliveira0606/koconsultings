import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getLeads, getMarketingDailyMetrics } from "@/lib/airtable/tables-ecom-simulation";
import { crossCheckLeads } from "@/lib/lead-cross-check";
import { sum } from "@/lib/metrics";

export const revalidate = 60;

function isPaidSource(source: string | null): boolean {
  return !!source && source.toLowerCase().includes("paid");
}
function isOrganicSource(source: string | null): boolean {
  return !!source && source.toLowerCase().includes("organic");
}

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const [leads, marketing] = await Promise.all([getLeads(), getMarketingDailyMetrics()]);

  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));

  const trackedPaid = inRangeLeads.filter((l) => isPaidSource(l.source)).length;
  const trackedOrganic = inRangeLeads.filter((l) => isOrganicSource(l.source)).length;
  const typedPaid = sum(inRangeMarketing.map((r) => r.optInsPaid));
  const typedOrganic = sum(inRangeMarketing.map((r) => r.optInsOrganic));

  const result = crossCheckLeads({ trackedPaid, trackedOrganic, typedPaid, typedOrganic });
  return Response.json(result);
}
