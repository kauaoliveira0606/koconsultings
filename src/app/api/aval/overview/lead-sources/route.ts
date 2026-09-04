import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange, toEasternDateOnly } from "@/lib/date-range";
import { getAvalLeads, getAvalMarketingDailyMetrics, getAvalAffiliatePcn } from "@/lib/airtable/tables-aval";
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
    getAvalLeads(),
    getAvalMarketingDailyMetrics(),
    getAvalAffiliatePcn(),
  ]);

  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));
  const inRangePcn = pcn.filter((r) => isDateInRange(r.date, range));
  const inRangePcnClosed = inRangePcn.filter((r) => r.cpaCash !== null);

  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta));

  // Tracked Paid/Organic counts, per day: the Leads table when it has
  // anything that day, else the Marketing Daily Metrics "Opt ins
  // (Paid/Organic)" count — what was tracked before the Leads table
  // became the live source.
  const leadsPaidByDate = new Map<string, number>();
  const leadsOrganicByDate = new Map<string, number>();
  for (const l of inRangeLeads) {
    const d = toEasternDateOnly(l.createdAt);
    if (!d) continue;
    if (isPaidSource(l.source)) leadsPaidByDate.set(d, (leadsPaidByDate.get(d) ?? 0) + 1);
    else if (isOrganicSource(l.source)) leadsOrganicByDate.set(d, (leadsOrganicByDate.get(d) ?? 0) + 1);
  }
  const mdmByDate = new Map(
    inRangeMarketing
      .map((r) => [toEasternDateOnly(r.date), r] as const)
      .filter((entry): entry is [string, (typeof inRangeMarketing)[number]] => entry[0] !== null)
  );
  const allDates = new Set([
    ...leadsPaidByDate.keys(),
    ...leadsOrganicByDate.keys(),
    ...mdmByDate.keys(),
  ]);
  let paidLeadsTracked = 0;
  let organicLeadsTracked = 0;
  for (const d of allDates) {
    const leadsPaid = leadsPaidByDate.get(d) ?? 0;
    const leadsOrganic = leadsOrganicByDate.get(d) ?? 0;
    const m = mdmByDate.get(d);
    paidLeadsTracked += leadsPaid > 0 ? leadsPaid : (m?.optInsPaid ?? 0);
    organicLeadsTracked += leadsOrganic > 0 ? leadsOrganic : (m?.optInsOrganic ?? 0);
  }

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
    totalLeadsTracked: paidLeadsTracked + organicLeadsTracked,
    paidLeadsTracked,
    organicLeadsTracked,
    cashCollectedPaid: merged.cashCollectedPaid,
    cashCollectedOrganic: merged.cashCollectedOrganic,
    unattributedCash: merged.unattributedCash,
    unattributedCount: merged.unattributedCount,
    adSpend,
    paidRoas: roas(merged.cashCollectedPaid, adSpend),
    costPerPaidLead: costPerLead(adSpend, paidLeadsTracked || null),
    costPerAcquisitionPaid: costPerAcquisition(adSpend, merged.paidClosedCount || null),
    pcn: {
      totalLogged: inRangePcn.length,
      matchedToLead,
      paidClosed: merged.paidClosedCount,
      organicClosed: merged.organicClosedCount,
    },
  });
}
