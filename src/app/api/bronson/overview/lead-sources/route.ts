import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getLeads, getMarketingDailyMetrics, getPostCallNotes, wasClosed } from "@/lib/airtable/tables";
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

// Post Call Note's own "Source of Lead" field is more granular than the
// Leads table's Paid/Organic — bucket it the same way so the two views are
// comparable. VSL Ad is Bronson's one paid (Meta) funnel; everything else
// logged here (Instagram, Youtube) is organic/content-driven.
function pcnBucket(source: string | null): "paid" | "organic" | null {
  if (!source) return null;
  if (source === "VSL Ad") return "paid";
  return "organic";
}

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [leads, marketing, postCallNotes] = await Promise.all([
    getLeads(),
    getMarketingDailyMetrics(),
    getPostCallNotes(),
  ]);

  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));
  const inRangePcn = postCallNotes.filter((r) => isDateInRange(r.date, range));

  const paidLeads = inRangeLeads.filter((l) => isPaidSource(l.source));
  const organicLeads = inRangeLeads.filter((l) => isOrganicSource(l.source));
  const paidCloses = paidLeads.filter((l) => l.cashCollected !== null && l.cashCollected > 0);

  const cashPaid = sum(paidLeads.map((l) => l.cashCollected));
  const cashOrganic = sum(organicLeads.map((l) => l.cashCollected));
  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta));

  const pcnPaid = inRangePcn.filter((r) => pcnBucket(r.source) === "paid");
  const pcnOrganic = inRangePcn.filter((r) => pcnBucket(r.source) === "organic");
  const pcnPaidClosed = pcnPaid.filter(wasClosed);
  const pcnOrganicClosed = pcnOrganic.filter(wasClosed);

  return Response.json({
    paidLeadsTracked: paidLeads.length,
    organicLeadsTracked: organicLeads.length,
    cashCollectedPaid: cashPaid,
    cashCollectedOrganic: cashOrganic,
    adSpend,
    paidRoas: roas(cashPaid, adSpend),
    costPerPaidLead: costPerLead(adSpend, paidLeads.length || null),
    costPerAcquisitionPaid: costPerAcquisition(adSpend, paidCloses.length || null),
    // Cross-check against Post Call Note's own per-call "Source of Lead" field
    // (closer-log granularity, not the top-of-funnel Leads table).
    pcn: {
      paidCallsLogged: pcnPaid.length,
      organicCallsLogged: pcnOrganic.length,
      paidClosed: pcnPaidClosed.length,
      organicClosed: pcnOrganicClosed.length,
      cashCollectedPaid: sum(pcnPaidClosed.map((r) => r.cashCollected)),
      cashCollectedOrganic: sum(pcnOrganicClosed.map((r) => r.cashCollected)),
      costPerAcquisitionPaid: costPerAcquisition(adSpend, pcnPaidClosed.length || null),
    },
  });
}
