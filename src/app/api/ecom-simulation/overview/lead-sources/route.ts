import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getLeads, getMarketingDailyMetrics } from "@/lib/airtable/tables-ecom-simulation";
import { roas, costPerLead, sum } from "@/lib/metrics";

export const revalidate = 60;

function isPaidSource(source: string | null): boolean {
  if (!source) return false;
  return source.toLowerCase().includes("paid");
}

function isOrganicSource(source: string | null): boolean {
  if (!source) return false;
  return source.toLowerCase().includes("organic");
}

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [leads, marketing] = await Promise.all([getLeads(), getMarketingDailyMetrics()]);

  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));

  const paidLeads = inRangeLeads.filter((l) => isPaidSource(l.source));
  const organicLeads = inRangeLeads.filter((l) => isOrganicSource(l.source));

  const cashPaid = sum(paidLeads.map((l) => l.cashCollected));
  const cashOrganic = sum(organicLeads.map((l) => l.cashCollected));
  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta));

  return Response.json({
    paidLeadsTracked: paidLeads.length,
    organicLeadsTracked: organicLeads.length,
    cashCollectedPaid: cashPaid,
    cashCollectedOrganic: cashOrganic,
    adSpend,
    paidRoas: roas(cashPaid, adSpend),
    costPerPaidLead: costPerLead(adSpend, paidLeads.length || null),
  });
}
