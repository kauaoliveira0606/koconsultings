import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getLeads, getMarketingDailyMetrics, getBronsonAffiliatePcn } from "@/lib/airtable/tables";
import {
  isPaidSource,
  isOrganicSource,
  mergeCashBySource,
  buildLeadSourceLookup,
  lookupSource,
} from "@/lib/airtable/lead-source-lookup";
import { roas, costPerLead, costPerAcquisition, sum } from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [leads, marketing, pcn] = await Promise.all([
    getLeads(),
    getMarketingDailyMetrics(),
    getBronsonAffiliatePcn(),
  ]);

  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));
  const inRangePcn = pcn.filter((r) => isDateInRange(r.date, range));
  const inRangePcnClosed = inRangePcn.filter((r) => r.cpaCash !== null);

  const paidLeads = inRangeLeads.filter((l) => isPaidSource(l.source));
  const organicLeads = inRangeLeads.filter((l) => isOrganicSource(l.source));
  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta));

  // Cash Collected — Paid/Organic: merges each Affiliate PCN close (matched
  // to its lead by email, dated by when the call closed) with any lead that
  // has its own direct Cash Collected value, deduped by email so nothing
  // gets counted twice.
  const merged = mergeCashBySource(leads, inRangeLeads, inRangePcnClosed);

  const lookup = buildLeadSourceLookup(leads);
  const matchedToLead = inRangePcn.filter((r) => lookupSource(lookup, r.leadEmail) !== null).length;

  // Paid / Organic cash & sales as reported directly on the Marketing
  // Daily Metrics form (separate from the PCN-derived figures above).
  const form = {
    salesLtPaid: sum(inRangeMarketing.map((r) => r.salesLowTicketPaid)),
    salesLtOrganic: sum(inRangeMarketing.map((r) => r.salesLowTicketOrganic)),
    cashLtPaid: sum(inRangeMarketing.map((r) => r.cashCollectedLowTicketPaid)),
    cashLtOrganic: sum(inRangeMarketing.map((r) => r.cashCollectedLowTicketOrganic)),
    cashHtPaid: sum(inRangeMarketing.map((r) => r.cashCollectedHighTicketPaid)),
    cashHtOrganic: sum(inRangeMarketing.map((r) => r.cashCollectedHighTicketOrganic)),
  };

  return Response.json({
    form,
    totalLeadsTracked: paidLeads.length + organicLeads.length,
    paidLeadsTracked: paidLeads.length,
    organicLeadsTracked: organicLeads.length,
    cashCollectedPaid: merged.cashCollectedPaid,
    cashCollectedOrganic: merged.cashCollectedOrganic,
    unattributedCash: merged.unattributedCash,
    unattributedCount: merged.unattributedCount,
    adSpend,
    paidRoas: roas(merged.cashCollectedPaid, adSpend),
    costPerPaidLead: costPerLead(adSpend, paidLeads.length || null),
    costPerAcquisitionPaid: costPerAcquisition(adSpend, merged.paidClosedCount || null),
    pcn: {
      totalLogged: inRangePcn.length,
      matchedToLead,
      paidClosed: merged.paidClosedCount,
      organicClosed: merged.organicClosedCount,
    },
  });
}
