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
