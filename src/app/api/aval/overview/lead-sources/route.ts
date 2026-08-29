import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getAvalLeads, getAvalMarketingDailyMetrics, getAvalPostCallNotes } from "@/lib/airtable/tables-aval";
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

  const [leads, marketing, notes] = await Promise.all([
    getAvalLeads(),
    getAvalMarketingDailyMetrics(),
    getAvalPostCallNotes(),
  ]);

  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));
  const inRangeNotes = notes.filter((r) => isDateInRange(r.date, range));
  const inRangeNotesClosed = inRangeNotes
    .filter((r) => r.cashCollected !== null)
    .map((r) => ({ leadEmail: r.leadEmail, cpaCash: r.cashCollected, date: r.date }));

  const paidLeads = inRangeLeads.filter((l) => isPaidSource(l.source));
  const organicLeads = inRangeLeads.filter((l) => isOrganicSource(l.source));
  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta));

  const merged = mergeCashBySource(leads, inRangeLeads, inRangeNotesClosed);

  const lookup = buildLeadSourceLookup(leads);
  const matchedToLead = inRangeNotes.filter((r) => lookupSource(lookup, r.leadEmail) !== null).length;

  return Response.json({
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
      totalLogged: inRangeNotes.length,
      matchedToLead,
      paidClosed: merged.paidClosedCount,
      organicClosed: merged.organicClosedCount,
    },
  });
}
