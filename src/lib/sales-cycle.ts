/**
 * Sales Cycle on the Overview tab (Bronson + Aval, user 2026-10-22): for every
 * lead who closed, the days from when they first opted in to when they closed.
 *
 * A close is the lead's FIRST close of each kind, so payment plan installments
 * and repeat notes don't count again:
 * - High Ticket: a Post Call Note with Call Outcome = Closed (PIF), Payment
 *   Plan or Deposit.
 * - Affiliate (Aval only; Bronson no longer runs affiliate): an Affiliate
 *   Post Call Note with cash logged.
 * A lead who bought affiliate first and high ticket later has one row each,
 * and on Aval also counts toward the affiliate to high ticket cycle: days from
 * their first affiliate sale to their first high ticket close.
 *
 * First opt-in is the earliest of the lead's GHL contact creation (every
 * funnel lands there: webinar, VSL, application, affiliate) and the Leads
 * table, matched by email. GHL creates a contact the first time someone
 * reaches us, so a lead who booked straight from a link is dated by that.
 * Leads with no match, or whose only record is dated after the close, stay
 * in the list with no cycle and are left out of the averages.
 */
import type { NextRequest } from "next/server";
import { airtableListAll } from "@/lib/airtable/client";
import { parseDateOnly, parseNumericText } from "@/lib/airtable/parse";
import { getLeads, type LeadRow } from "@/lib/airtable/tables";
import { getAvalLeads } from "@/lib/airtable/tables-aval";
import { normalizeEmail } from "@/lib/airtable/lead-source-lookup";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange, toEasternDateOnly } from "@/lib/date-range";
import { average, median } from "@/lib/metrics";
import { staleWhileRevalidate } from "@/lib/swr-cache";

// Same table ID in every offer's base (the bases were cloned from one template).
const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";
const CLOSED_OUTCOMES = ["Closed (PIF)", "Payment Plan", "Deposit"];
const GHL_API = "https://services.leadconnectorhq.com";

type SalesCycleOffer = {
  key: "bronson" | "aval";
  baseId: string;
  getLeads: () => Promise<LeadRow[]>;
  ghlPatEnv: string;
  ghlLocationEnv: string;
  affiliatePcn: { tableId: string; emailField: string; nameField: string; repField: string; cashField: string } | null;
};

export const SALES_CYCLE_OFFERS: Record<"bronson" | "aval", SalesCycleOffer> = {
  bronson: {
    key: "bronson",
    baseId: "appiMw8gpaLv2WITA",
    getLeads,
    ghlPatEnv: "GHL_BRONSON_PIT",
    ghlLocationEnv: "GHL_BRONSON_LOCATION_ID",
    affiliatePcn: null,
  },
  aval: {
    key: "aval",
    baseId: "appgEcTIxQjmtRKbP",
    getLeads: getAvalLeads,
    ghlPatEnv: "GHL_AVAL_PIT",
    ghlLocationEnv: "GHL_AVAL_LOCATION_ID",
    affiliatePcn: {
      tableId: "tblFZy89IvQ6Dcsl0",
      emailField: "Lead Email",
      nameField: "Lead Name",
      repField: "Your Name",
      cashField: "CPA?",
    },
  },
};

export type SalesCycleRow = {
  id: string;
  kind: "High Ticket" | "Affiliate";
  name: string | null;
  email: string | null;
  rep: string | null;
  /** Call Outcome for high ticket; "Sale" for affiliate. */
  outcome: string | null;
  offer: string | null;
  cashCollected: number | null;
  optInDate: string | null;
  /** Where the opt-in date came from. */
  optInFrom: "GHL" | "Leads Table" | null;
  closeDate: string;
  /** Whole days from first opt-in to close; null when there is no usable opt-in. */
  days: number | null;
};

/** A lead who bought affiliate first and later closed high ticket (Aval). */
export type AscensionRow = {
  email: string;
  name: string | null;
  affiliateDate: string;
  highTicketDate: string;
  highTicketOutcome: string | null;
  highTicketOffer: string | null;
  highTicketCash: number | null;
  /** Whole days from the first affiliate sale to the first high ticket close. */
  days: number;
};

export type SalesCycleResponse = {
  rows: SalesCycleRow[];
  /** Affiliate to high ticket, by high ticket close date in range; empty without affiliate. */
  ascensions: AscensionRow[];
  avgDaysAscension: number | null;
  medianDaysAscension: number | null;
  closes: number;
  matched: number;
  avgDays: number | null;
  medianDays: number | null;
  avgDaysHighTicket: number | null;
  avgDaysAffiliate: number | null;
  hasAffiliate: boolean;
  /** False when this deploy has no GHL key, so opt-ins come from the Leads table only. */
  ghlConnected: boolean;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);

/** Earliest GHL contact creation (Eastern date) per email; 100 emails per search. */
async function ghlFirstSeen(offer: SalesCycleOffer, emails: string[]): Promise<Map<string, string>> {
  const pat = process.env[offer.ghlPatEnv];
  const locationId = process.env[offer.ghlLocationEnv];
  const out = new Map<string, string>();
  // No key in this environment: Leads table dates only, rather than no section.
  if (!pat || !locationId) return out;
  const chunks: string[][] = [];
  for (let i = 0; i < emails.length; i += 100) chunks.push(emails.slice(i, i + 100));
  // A few at a time: GHL allows about 100 requests per 10 seconds.
  for (let i = 0; i < chunks.length; i += 4) {
    await Promise.all(
      chunks.slice(i, i + 4).map(async (chunk) => {
        const res = await fetch(`${GHL_API}/contacts/search`, {
          method: "POST",
          headers: { Authorization: `Bearer ${pat}`, Version: "2021-07-28", "Content-Type": "application/json" },
          body: JSON.stringify({ locationId, pageLimit: 500, filters: [{ field: "email", operator: "eq", value: chunk }] }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`GHL contact search failed (${res.status})`);
        const { contacts } = (await res.json()) as { contacts: { email: string | null; dateAdded: string | null }[] };
        for (const c of contacts) {
          const email = normalizeEmail(c.email);
          const date = toEasternDateOnly(c.dateAdded);
          if (!email || !date) continue;
          const seen = out.get(email);
          if (!seen || date < seen) out.set(email, date);
        }
      }),
    );
  }
  return out;
}

async function buildRows(offer: SalesCycleOffer): Promise<SalesCycleRow[]> {
  const [notes, affiliate, leads] = await Promise.all([
    airtableListAll<Record<string, unknown>>(offer.baseId, POST_CALL_NOTE_TABLE_ID, {
      filterByFormula: `OR(${CLOSED_OUTCOMES.map((o) => `{Call Outcome}='${o}'`).join(",")})`,
    }),
    offer.affiliatePcn
      ? airtableListAll<Record<string, unknown>>(offer.baseId, offer.affiliatePcn.tableId)
      : Promise.resolve([]),
    offer.getLeads(),
  ]);

  // First close per lead per kind, oldest note first.
  const firstClose = new Map<string, SalesCycleRow>();
  const keep = (row: SalesCycleRow) => {
    const key = `${row.kind}|${row.email ?? row.name?.toLowerCase() ?? row.id}`;
    const seen = firstClose.get(key);
    if (!seen || row.closeDate < seen.closeDate) firstClose.set(key, row);
  };
  for (const r of notes) {
    const f = r.fields;
    const closeDate = parseDateOnly(f.Date);
    if (!closeDate) continue;
    keep({
      id: r.id,
      kind: "High Ticket",
      name: str(f["Full Name (Lead)"]),
      email: normalizeEmail(str(f["Email (Lead)"])),
      rep: str(f["Setters Full Name"]) ?? str(f["Setters Name"]),
      outcome: str(f["Call Outcome"]),
      offer: str(f["Offer Pitched On/Closed"]),
      cashCollected: parseNumericText(f["Cash Collected"]),
      optInDate: null,
      optInFrom: null,
      closeDate,
      days: null,
    });
  }
  const aff = offer.affiliatePcn;
  for (const r of aff ? affiliate : []) {
    const f = r.fields;
    const closeDate = parseDateOnly(f.Date);
    const cash = parseNumericText(f[aff!.cashField]);
    if (!closeDate || !cash) continue;
    keep({
      id: r.id,
      kind: "Affiliate",
      name: str(f[aff!.nameField]),
      email: normalizeEmail(str(f[aff!.emailField])),
      rep: str(f[aff!.repField]),
      outcome: "Sale",
      offer: str(f["Which Software"]) ?? str(f["Plan?"]),
      cashCollected: cash,
      optInDate: null,
      optInFrom: null,
      closeDate,
      days: null,
    });
  }
  const rows = [...firstClose.values()];

  const leadFirst = new Map<string, string>();
  for (const l of leads) {
    const email = normalizeEmail(l.email);
    const date = toEasternDateOnly(l.createdAt);
    if (!email || !date) continue;
    const seen = leadFirst.get(email);
    if (!seen || date < seen) leadFirst.set(email, date);
  }
  const emails = [...new Set(rows.map((r) => r.email).filter((e): e is string => !!e))];
  const ghl = await ghlFirstSeen(offer, emails);

  for (const row of rows) {
    if (!row.email) continue;
    const candidates = [
      { date: ghl.get(row.email), from: "GHL" as const },
      { date: leadFirst.get(row.email), from: "Leads Table" as const },
    ].filter((c): c is { date: string; from: "GHL" | "Leads Table" } => !!c.date);
    if (candidates.length === 0) continue;
    const first = candidates.sort((a, b) => a.date.localeCompare(b.date))[0];
    row.optInDate = first.date;
    row.optInFrom = first.from;
    const days = daysBetween(first.date, row.closeDate);
    row.days = days >= 0 ? days : null;
  }
  return rows.sort((a, b) => b.closeDate.localeCompare(a.closeDate));
}

/** Every closed lead's sales cycle, cached 15 minutes (re-read in the background after that). */
export function getSalesCycleRows(offer: SalesCycleOffer): Promise<SalesCycleRow[]> {
  return staleWhileRevalidate(`sales-cycle:${offer.key}:v2`, () => buildRows(offer), 900, 24 * 60 * 60);
}

/** The Overview route: closes dated inside the range, with the averages over the ones that have a cycle. */
export function salesCycleGet(offer: SalesCycleOffer) {
  return async (request: NextRequest) => {
    const range = parseRangeFromRequest(request);
    const all = await getSalesCycleRows(offer);
    const rows = all.filter((r) => isDateInRange(r.closeDate, range));
    // Affiliate -> high ticket: the same email's first affiliate sale, then a
    // later (or same-day) first high ticket close. Matched by email only.
    const firstAffiliate = new Map<string, SalesCycleRow>();
    for (const r of all) if (r.kind === "Affiliate" && r.email) firstAffiliate.set(r.email, r);
    const ascensions: AscensionRow[] = [];
    for (const ht of rows) {
      const aff = ht.kind === "High Ticket" && ht.email ? firstAffiliate.get(ht.email) : undefined;
      if (!aff || aff.closeDate > ht.closeDate) continue;
      ascensions.push({
        email: ht.email!,
        name: ht.name ?? aff.name,
        affiliateDate: aff.closeDate,
        highTicketDate: ht.closeDate,
        highTicketOutcome: ht.outcome,
        highTicketOffer: ht.offer,
        highTicketCash: ht.cashCollected,
        days: daysBetween(aff.closeDate, ht.closeDate),
      });
    }
    const days = (kind?: SalesCycleRow["kind"]) =>
      rows.filter((r) => !kind || r.kind === kind).map((r) => r.days);
    return Response.json({
      rows,
      ascensions,
      avgDaysAscension: average(ascensions.map((a) => a.days)),
      medianDaysAscension: median(ascensions.map((a) => a.days)),
      closes: rows.length,
      matched: rows.filter((r) => r.days !== null).length,
      avgDays: average(days()),
      medianDays: median(days()),
      avgDaysHighTicket: average(days("High Ticket")),
      avgDaysAffiliate: average(days("Affiliate")),
      hasAffiliate: !!offer.affiliatePcn,
      ghlConnected: !!process.env[offer.ghlPatEnv] && !!process.env[offer.ghlLocationEnv],
    } satisfies SalesCycleResponse);
  };
}
