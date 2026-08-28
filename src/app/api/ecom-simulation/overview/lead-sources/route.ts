import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import {
  getLeads,
  getMarketingDailyMetrics,
  getAffiliatePcn,
} from "@/lib/airtable/tables-ecom-simulation";
import { buildLeadSourceLookup, lookupSource } from "@/lib/airtable/lead-source-lookup";
import { roas, costPerLead, costPerAcquisition, sum } from "@/lib/metrics";

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

  const [leads, marketing, pcn] = await Promise.all([
    getLeads(),
    getMarketingDailyMetrics(),
    getAffiliatePcn(),
  ]);

  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));
  const inRangePcn = pcn.filter((r) => isDateInRange(r.date, range));

  const paidLeads = inRangeLeads.filter((l) => isPaidSource(l.source));
  const organicLeads = inRangeLeads.filter((l) => isOrganicSource(l.source));
  const paidCloses = paidLeads.filter((l) => l.cashCollected !== null && l.cashCollected > 0);

  const cashPaid = sum(paidLeads.map((l) => l.cashCollected));
  const cashOrganic = sum(organicLeads.map((l) => l.cashCollected));
  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta));

  // Cross-reference: match each Affiliate PCN close to its lead by email,
  // then use the Leads table's own Paid/Organic tag (Affiliate PCN has no
  // source field of its own) to attribute the sale to a source.
  const lookup = buildLeadSourceLookup(leads);
  const pcnWithSource = inRangePcn.map((r) => ({
    ...r,
    matchedSource: lookupSource(lookup, r.leadEmail),
  }));
  const pcnMatched = pcnWithSource.filter((r) => r.matchedSource !== null);
  const pcnPaid = pcnMatched.filter((r) => isPaidSource(r.matchedSource));
  const pcnOrganic = pcnMatched.filter((r) => isOrganicSource(r.matchedSource));
  const pcnPaidClosed = pcnPaid.filter((r) => r.cpaCash !== null);
  const pcnOrganicClosed = pcnOrganic.filter((r) => r.cpaCash !== null);

  return Response.json({
    paidLeadsTracked: paidLeads.length,
    organicLeadsTracked: organicLeads.length,
    cashCollectedPaid: cashPaid,
    cashCollectedOrganic: cashOrganic,
    adSpend,
    paidRoas: roas(cashPaid, adSpend),
    costPerPaidLead: costPerLead(adSpend, paidLeads.length || null),
    costPerAcquisitionPaid: costPerAcquisition(adSpend, paidCloses.length || null),
    pcn: {
      totalLogged: inRangePcn.length,
      matchedToLead: pcnMatched.length,
      paidCallsMatched: pcnPaid.length,
      organicCallsMatched: pcnOrganic.length,
      paidClosed: pcnPaidClosed.length,
      organicClosed: pcnOrganicClosed.length,
      cashCollectedPaid: sum(pcnPaidClosed.map((r) => r.cpaCash)),
      cashCollectedOrganic: sum(pcnOrganicClosed.map((r) => r.cpaCash)),
      costPerAcquisitionPaid: costPerAcquisition(adSpend, pcnPaidClosed.length || null),
    },
  });
}
