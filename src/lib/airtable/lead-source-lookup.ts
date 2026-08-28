import type { LeadRow } from "./tables";

/**
 * Cross-references per-call records (Affiliate PCN, Post Call Note) against
 * the Leads table by email, so "was this closed deal a Paid or Organic lead"
 * comes from the Leads table's own Source field rather than a free-text
 * source field on the call log — the two don't always agree, and the Leads
 * table is the canonical Paid/Organic tagging used everywhere else.
 */
export type LeadSourceLookup = Map<string, string | null>;

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/^mailto:/, "");
  return cleaned || null;
}

export function buildLeadSourceLookup(leads: LeadRow[]): LeadSourceLookup {
  const map: LeadSourceLookup = new Map();
  for (const lead of leads) {
    const email = normalizeEmail(lead.email);
    if (email) map.set(email, lead.source);
  }
  return map;
}

export function lookupSource(
  lookup: LeadSourceLookup,
  rawEmail: string | null | undefined
): string | null {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;
  return lookup.get(email) ?? null;
}

export function isPaidSource(source: string | null): boolean {
  if (!source) return false;
  return source.toLowerCase().includes("paid");
}

export function isOrganicSource(source: string | null): boolean {
  if (!source) return false;
  return source.toLowerCase().includes("organic");
}

export type ClosedCallRow = { leadEmail: string | null; cpaCash: number | null };

export type CashBySourceResult = {
  cashCollectedPaid: number | null;
  cashCollectedOrganic: number | null;
  paidClosedCount: number;
  organicClosedCount: number;
  unattributedCash: number | null;
  unattributedCount: number;
};

/**
 * The definitive "cash collected by source" for a range: PCN closes (email-
 * matched to a lead's Paid/Organic tag, dated by when the call closed) plus
 * any lead with its own direct Cash Collected value (dated by lead creation)
 * that ISN'T already counted via a PCN match — so a lead never gets summed
 * twice just because both tables happen to have a number for them.
 */
export function mergeCashBySource(
  allLeads: LeadRow[],
  inRangeLeads: LeadRow[],
  pcnClosedInRange: ClosedCallRow[]
): CashBySourceResult {
  const lookup = buildLeadSourceLookup(allLeads);

  const paidPcnCash: number[] = [];
  const organicPcnCash: number[] = [];
  let unattributedCash = 0;
  let unattributedCount = 0;
  const matchedEmails = new Set<string>();

  for (const r of pcnClosedInRange) {
    if (r.cpaCash === null) continue;
    const email = normalizeEmail(r.leadEmail);
    const source = email ? (lookup.get(email) ?? null) : null;
    if (!email || source === null) {
      unattributedCash += r.cpaCash;
      unattributedCount += 1;
      continue;
    }
    if (isPaidSource(source)) {
      matchedEmails.add(email);
      paidPcnCash.push(r.cpaCash);
    } else if (isOrganicSource(source)) {
      matchedEmails.add(email);
      organicPcnCash.push(r.cpaCash);
    } else {
      unattributedCash += r.cpaCash;
      unattributedCount += 1;
    }
  }

  const paidDirectCash: number[] = [];
  const organicDirectCash: number[] = [];
  for (const lead of inRangeLeads) {
    if (lead.cashCollected === null || lead.cashCollected <= 0) continue;
    const email = normalizeEmail(lead.email);
    if (email && matchedEmails.has(email)) continue;
    if (isPaidSource(lead.source)) paidDirectCash.push(lead.cashCollected);
    else if (isOrganicSource(lead.source)) organicDirectCash.push(lead.cashCollected);
  }

  const allPaidCash = [...paidPcnCash, ...paidDirectCash];
  const allOrganicCash = [...organicPcnCash, ...organicDirectCash];

  return {
    cashCollectedPaid: allPaidCash.length
      ? allPaidCash.reduce((a, b) => a + b, 0)
      : null,
    cashCollectedOrganic: allOrganicCash.length
      ? allOrganicCash.reduce((a, b) => a + b, 0)
      : null,
    paidClosedCount: allPaidCash.length,
    organicClosedCount: allOrganicCash.length,
    unattributedCash: unattributedCount ? unattributedCash : null,
    unattributedCount,
  };
}
