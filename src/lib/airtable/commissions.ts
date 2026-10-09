import { airtableListAll, airtableListAllIncremental } from "./client";
import { listClawbacks, type Clawback, type ClawbacksTable } from "./clawbacks";
import { parseDateOnly, parseNumericText } from "./parse";
import { isDateInRange, toEasternDateOnly, type ResolvedRange } from "@/lib/date-range";
import { DEAL_FEE_RATES, type DealFeeRates } from "@/lib/deal-fee-rates";

/**
 * Sales-team commissions (Bronson and Aval share the rules), split by ticket size.
 *
 * Low ticket (Base44 / Wix software, setter is full cycle): 10% flat, every
 * day of the week, no fees. Worked out both ways, by what the rep logged in
 * Affiliate PCN and by what was actually attributed; the payout is on the
 * attributed (real) cash.
 *  - Real cash      = what the affiliate portal actually tracked for the rep's
 *                     Shared ID ("Affiliate Portal By Rep", synced daily by the
 *                     n8n Base44/Wix Attribution Collector; sub_id_2 = the rep).
 *  - Submitted cash = what the rep logged themselves in "Affiliate PCN".
 *
 * High ticket ("Post Call Note"): closer 10%, setter 5% of cash collected
 * after fees: the offer's processing rate on every deal (2.5%), plus
 * a further 15% when "Where Was Payment Collected On" is a financing option.
 * The same fees come off before the agency's own split.
 * A rep who both set and closed the deal gets both (15%). Later installments
 * logged in "Follow Up Payment" pay the same way.
 *
 * Clawbacks are entered by hand on the tab ("Commission Clawbacks") and come
 * off the rep's total in the pay period their date falls in.
 */

// Same table IDs in every offer's base (the bases were cloned from one template).
const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";
const FOLLOW_UP_PAYMENT_TABLE_ID = "tblIv06rB4qG0msnZ";

export type CommissionsOffer = {
  baseId: string;
  affiliatePortalByRepTableId: string;
  affiliatePcnTableId: string;
  /** Affiliate PCN field holding the rep's name / the CPA cash. */
  affiliatePcnRepField: string;
  affiliatePcnCashField: string;
  clawbacksTableId: string;
  /** Fees that come off high ticket cash before commission. */
  feeRates: DealFeeRates;
  /** The portal only started stamping Shared IDs on sales from this date. */
  sharedIdTrackingStart: string;
  /**
   * Portal Shared IDs (lowercase) that are spelled differently from the rep's
   * name in Airtable, mapped to that name so they land on the same card.
   */
  sharedIdAliases?: Record<string, string>;
  /**
   * Leads table (Email + Source = Paid/Organic). When set, commissions are
   * also split by traffic source, for offers on a paid-traffic profit share.
   */
  leadsTableId?: string;
};

/** Where the lead behind a sale came from, by matching its email to the Leads table. */
export type LeadSource = "paid" | "organic" | "unmatched";

export const COMMISSIONS_OFFERS = {
  bronson: {
    baseId: "appiMw8gpaLv2WITA",
    affiliatePortalByRepTableId: "tblLc3CJh5lbxAq67",
    affiliatePcnTableId: "tblXsKo89QNuRawBy",
    affiliatePcnRepField: "Full Name",
    affiliatePcnCashField: "CPA (Payout / Cash Collected)",
    clawbacksTableId: "tblEWLBxlRGjhDmyJ",
    feeRates: DEAL_FEE_RATES.bronson,
    sharedIdTrackingStart: "2026-09-08",
    leadsTableId: "tbl4E1VNyL7ZbTi5C",
  },
  aval: {
    baseId: "appgEcTIxQjmtRKbP",
    affiliatePortalByRepTableId: "tbl4W4Yr4noU0wAUa",
    affiliatePcnTableId: "tblFZy89IvQ6Dcsl0",
    affiliatePcnRepField: "Your Name",
    affiliatePcnCashField: "CPA?",
    clawbacksTableId: "tblXW3TcyTcWdYYtV",
    feeRates: DEAL_FEE_RATES.aval,
    sharedIdTrackingStart: "2026-09-11",
    // "Keizer" is how Khizer's link is spelled on the portal; K and R can only
    // be Khizer and Rashardo. M / J / S are ambiguous (Moe/Melissa/Mohamad,
    // Jarek/James, Seb/Sahil) so they stay as their own cards until confirmed.
    sharedIdAliases: { keizer: "Khizer", k: "Khizer", r: "Rashardo", moecopy: "Moe" },
  },
} satisfies Record<string, CommissionsOffer>;

export const LOW_TICKET_RATE = 0.1;
export const HIGH_TICKET_CLOSER_RATE = 0.1;
export const HIGH_TICKET_SETTER_RATE = 0.05;
const FINANCED = /^financed/i;

/** Portal sales that came through without a Shared ID — nobody is paid on these. */
export const UNASSIGNED_SHARED_ID = "Unassigned";

const NO_SETTER = /^no setter/i;

export const clawbacksTable = (offer: CommissionsOffer): ClawbacksTable => ({
  baseId: offer.baseId,
  tableId: offer.clawbacksTableId,
});

export type LowTicketRepRow = {
  rep: string;
  /** Portal sales under the rep's Shared ID that still stand (reversed ones taken out). */
  realSales: number;
  realCash: number;
  reversedSales: number;
  reversedCash: number;
  submittedSales: number;
  submittedCash: number;
  /** Real cash minus submitted cash (negative = portal tracked less than the rep logged). */
  gap: number;
  /** Every portal sale under the Shared ID, reversed included. */
  trackedSales: number;
  /** trackedSales / submittedSales — same definition as the Overview attribution rate. */
  attributionRate: number | null;
  /** Paid on real (attributed) cash only. */
  commission: number;
  /** What the same rate would pay on the cash the rep logged in Affiliate PCN. */
  submittedCommission: number;
  /**
   * Part of `commission` that came from paid traffic. The portal doesn't say
   * which lead bought, so each day's real commission is split by the paid
   * share of what the rep submitted in that pay period.
   */
  paidCommission: number;
  /** Submitted cash whose lead matched a Paid lead (unmatched counts as organic). */
  submittedPaidCash: number;
  submittedUnmatchedSales: number;
};

export type HighTicketRepRow = {
  rep: string;
  closedDeals: number;
  closedCash: number;
  /** Closed cash after processing and financing fees. */
  closedNetCash: number;
  closerCommission: number;
  setDeals: number;
  setCash: number;
  setNetCash: number;
  setterCommission: number;
  commission: number;
};

export type HighTicketDeal = {
  id: string;
  /** First payment (Post Call Note) or a later installment (Follow Up Payment). */
  kind: "new_deal" | "follow_up";
  date: string | null;
  lead: string | null;
  closer: string | null;
  setter: string | null;
  offer: string | null;
  outcome: string | null;
  cashCollected: number;
  paymentMethod: string | null;
  /** "Where Was Payment Collected On" is a financing option. */
  financed: boolean;
  feeRate: number;
  processingFee: number;
  /** The extra cut on a financed deal; 0 otherwise. */
  financingFee: number;
  /** Cash collected minus the fee — what commission is paid on. */
  netCash: number;
  closerCommission: number;
  setterCommission: number;
  leadEmail: string | null;
  leadSource: LeadSource;
};

export type CommissionTotalRow = {
  rep: string;
  lowTicket: number;
  highTicketCloser: number;
  highTicketSetter: number;
  clawbacks: number;
  total: number;
  /** Part of the commission (before clawbacks) that came from paid traffic. */
  paid: number;
};

/** A sale whose lead email isn't in the Leads table, so it counts as organic. */
export type UnmatchedLead = {
  id: string;
  kind: "low_ticket" | "high_ticket";
  date: string | null;
  rep: string | null;
  lead: string | null;
  email: string | null;
  cash: number;
};

export type CommissionsResponse = {
  rates: {
    lowTicket: number;
    highTicketCloser: number;
    highTicketSetter: number;
    highTicketProcessingFee: number;
    /** Extra on a financed deal, on top of processing. */
    highTicketFinancingFee: number;
  };
  sharedIdTrackingStart: string;
  totals: {
    commission: number;
    lowTicketCommission: number;
    highTicketCommission: number;
    lowTicketRealCash: number;
    lowTicketSubmittedCash: number;
    /** What low ticket would pay on logged (Affiliate PCN) cash instead of attributed. */
    lowTicketSubmittedCommission: number;
    /** Team-wide: portal sales with a Shared ID / Affiliate PCN submissions. */
    lowTicketAttributionRate: number | null;
    lowTicketTrackedSales: number;
    lowTicketSubmittedSales: number;
    unassignedCash: number;
    unassignedSales: number;
    highTicketCash: number;
    highTicketNetCash: number;
    highTicketFinancedCash: number;
    highTicketProcessingFees: number;
    highTicketFinancingFees: number;
    highTicketCloserCommission: number;
    highTicketSetterCommission: number;
    clawbacks: number;
    /** Commission from paid traffic / everything else, before clawbacks. */
    paidCommission: number;
    organicCommission: number;
  };
  /** Whether this offer splits commissions by Paid vs Organic traffic. */
  paidSplit: boolean;
  unmatchedLeads: UnmatchedLead[];
  /** When the portal collector last wrote real cash (ISO), null if never. */
  portalSyncedAt: string | null;
  clawbacks: Clawback[];
  byRep: CommissionTotalRow[];
  lowTicket: LowTicketRepRow[];
  highTicket: HighTicketRepRow[];
  highTicketDeals: HighTicketDeal[];
};

/** "niko", "Niko " and "NIKO" are the same rep; the first spelling seen names them. */
class RepIndex<T> {
  private rows = new Map<string, T>();
  constructor(private create: (rep: string) => T) {}

  get(name: string): T {
    const key = name.trim().toLowerCase();
    let row = this.rows.get(key);
    if (!row) {
      const display = name.trim();
      row = this.create(display.charAt(0).toUpperCase() + display.slice(1));
      this.rows.set(key, row);
    }
    return row;
  }

  values(): T[] {
    return Array.from(this.rows.values());
  }
}

/**
 * Some forms stamp Date with the UTC day, so an 8pm+ ET submission reads as
 * tomorrow. When Date is exactly the UTC day the record was created, trust
 * the Eastern day of the creation time instead (same rule as Live Cash Today).
 */
function rowEasternDate(dateField: unknown, createdTime: string): string | null {
  const date = parseDateOnly(dateField);
  if (date && createdTime && date === createdTime.slice(0, 10)) {
    return toEasternDateOnly(createdTime);
  }
  return date;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const normalizeEmail = (value: unknown): string | null =>
  text(value)?.toLowerCase().replace(/^mailto:/, "") || null;

/** Pay period a day's low ticket paid share is judged over: 1st-15th or 16th-end. */
const sharePeriodKey = (date: string) => `${date.slice(0, 7)}-${date.slice(8, 10) <= "15" ? "a" : "b"}`;

export async function getCommissions(
  offer: CommissionsOffer,
  range: ResolvedRange
): Promise<CommissionsResponse> {
  return (await computeCommissions(offer, range, true)).response;
}

/**
 * Actual paid-traffic sales team commission per day, all time — what the
 * Agency page deducts from paid profit. Empty for offers without a paid split.
 */
export async function getPaidCommissionsByDay(offer: CommissionsOffer): Promise<Map<string, number>> {
  return (await computeCommissions(offer, { start: null, end: null }, false)).paidByDay;
}

/**
 * True low ticket cash per day: what the affiliate portal tracked (every
 * Shared ID, including sales with none; reversed sales taken out). This is
 * the money that actually gets paid, as opposed to what reps log.
 */
export async function getPortalCashByDay(offer: CommissionsOffer): Promise<Map<string, number>> {
  const records = await airtableListAll<Record<string, unknown>>(
    offer.baseId,
    offer.affiliatePortalByRepTableId
  );
  const byDay = new Map<string, number>();
  for (const r of records) {
    const date = parseDateOnly(r.fields.Date);
    if (!date) continue;
    byDay.set(date, (byDay.get(date) ?? 0) + (parseNumericText(r.fields.Commission) ?? 0));
  }
  return byDay;
}

async function computeCommissions(
  offer: CommissionsOffer,
  range: ResolvedRange,
  withClawbacks: boolean
): Promise<{ response: CommissionsResponse; paidByDay: Map<string, number> }> {
  const { baseId } = offer;
  const aliases: Record<string, string> = offer.sharedIdAliases ?? {};
  const list = (tableId: string) => airtableListAll<Record<string, unknown>>(baseId, tableId);
  const [
    portalRecords,
    affiliatePcnRecords,
    postCallNoteRecords,
    followUpRecords,
    leadRecords,
    allClawbacks,
  ] = await Promise.all([
    list(offer.affiliatePortalByRepTableId),
    list(offer.affiliatePcnTableId),
    list(POST_CALL_NOTE_TABLE_ID),
    list(FOLLOW_UP_PAYMENT_TABLE_ID),
    // The Leads table is big: same partitioned read as the rest of the dashboard.
    offer.leadsTableId
      ? airtableListAllIncremental<Record<string, unknown>>(baseId, offer.leadsTableId)
      : Promise.resolve([]),
    withClawbacks ? listClawbacks(clawbacksTable(offer)) : Promise.resolve([]),
  ]);

  // ---- Paid vs Organic, by the lead's email in the Leads table ----------
  const paidSplit = Boolean(offer.leadsTableId);
  const sourceByEmail = new Map<string, string>();
  for (const r of leadRecords) {
    const email = normalizeEmail(r.fields.Email);
    const source = text(r.fields.Source);
    if (email && source) sourceByEmail.set(email, source.toLowerCase());
  }
  const leadSource = (email: string | null): LeadSource => {
    const source = email ? sourceByEmail.get(email) : undefined;
    if (!source) return "unmatched";
    return source.includes("paid") ? "paid" : "organic";
  };
  const unmatchedLeads: UnmatchedLead[] = [];
  const paidByDay = new Map<string, number>();
  const addPaid = (date: string | null, amount: number) => {
    if (date && amount) paidByDay.set(date, (paidByDay.get(date) ?? 0) + amount);
  };

  let portalSyncedAt: string | null = null;
  for (const r of portalRecords) {
    const synced = text(r.fields["Synced At"]);
    const ms = synced ? Date.parse(synced) : NaN;
    if (Number.isFinite(ms) && (!portalSyncedAt || ms > Date.parse(portalSyncedAt))) {
      portalSyncedAt = new Date(ms).toISOString();
    }
  }

  // ---- Low ticket -------------------------------------------------------
  const lowTicket = new RepIndex<LowTicketRepRow>((rep) => ({
    rep,
    realSales: 0,
    realCash: 0,
    reversedSales: 0,
    reversedCash: 0,
    submittedSales: 0,
    submittedCash: 0,
    gap: 0,
    trackedSales: 0,
    attributionRate: null,
    commission: 0,
    submittedCommission: 0,
    paidCommission: 0,
    submittedPaidCash: 0,
    submittedUnmatchedSales: 0,
  }));

  // Submitted side first: it also gives each rep's paid share per pay period,
  // which is what splits their real (portal) commission into paid vs organic.
  const submittedShare = new Map<string, { paid: number; total: number }>();
  for (const r of affiliatePcnRecords) {
    const f = r.fields;
    const rep = text(f[offer.affiliatePcnRepField]);
    const date = rowEasternDate(f.Date, r.createdTime);
    if (!rep || !date) continue;
    const cash = parseNumericText(f[offer.affiliatePcnCashField]) ?? 0;
    const email = normalizeEmail(f["lead email"] ?? f["Lead Email"]);
    const source = paidSplit ? leadSource(email) : "organic";

    const key = `${rep.toLowerCase()}::${sharePeriodKey(date)}`;
    const share = submittedShare.get(key) ?? { paid: 0, total: 0 };
    share.total += cash;
    if (source === "paid") share.paid += cash;
    submittedShare.set(key, share);

    if (!isDateInRange(date, range)) continue;
    const row = lowTicket.get(rep);
    row.submittedSales += 1;
    row.submittedCash += cash;
    if (source === "paid") row.submittedPaidCash += cash;
    if (source === "unmatched") {
      row.submittedUnmatchedSales += 1;
      unmatchedLeads.push({
        id: r.id,
        kind: "low_ticket",
        date,
        rep: row.rep,
        lead: text(f["Lead name"] ?? f["Lead Name"]),
        email,
        cash,
      });
    }
  }
  const paidShare = (rep: string, date: string): number => {
    const share = submittedShare.get(`${rep.toLowerCase()}::${sharePeriodKey(date)}`);
    return share && share.total > 0 ? share.paid / share.total : 0;
  };

  let unassignedCash = 0;
  let unassignedSales = 0;

  for (const r of portalRecords) {
    const f = r.fields;
    const date = parseDateOnly(f.Date);
    if (!date || !isDateInRange(date, range)) continue;
    const sharedId = text(f["Shared ID"]) ?? UNASSIGNED_SHARED_ID;
    const sales = parseNumericText(f.Purchases) ?? 0;
    const cash = parseNumericText(f.Commission) ?? 0;
    if (sharedId.toLowerCase() === UNASSIGNED_SHARED_ID.toLowerCase()) {
      unassignedSales += sales;
      unassignedCash += cash;
      continue;
    }
    const row = lowTicket.get(aliases[sharedId.toLowerCase()] ?? sharedId);
    row.realSales += sales;
    row.realCash += cash;
    row.reversedSales += parseNumericText(f["Reversed Purchases"]) ?? 0;
    row.reversedCash += parseNumericText(f["Reversed Commission"]) ?? 0;
    if (paidSplit) {
      const paid = cash * LOW_TICKET_RATE * paidShare(row.rep, date);
      row.paidCommission += paid;
      addPaid(date, paid);
    }
  }

  const lowTicketRows = lowTicket.values();
  for (const row of lowTicketRows) {
    row.gap = row.realCash - row.submittedCash;
    row.trackedSales = row.realSales + row.reversedSales;
    row.attributionRate = row.submittedSales > 0 ? row.trackedSales / row.submittedSales : null;
    row.commission = row.realCash * LOW_TICKET_RATE;
    row.submittedCommission = row.submittedCash * LOW_TICKET_RATE;
  }
  lowTicketRows.sort((a, b) => b.realCash - a.realCash || b.submittedCash - a.submittedCash);

  // ---- High ticket ------------------------------------------------------
  const highTicket = new RepIndex<HighTicketRepRow>((rep) => ({
    rep,
    closedDeals: 0,
    closedCash: 0,
    closedNetCash: 0,
    closerCommission: 0,
    setDeals: 0,
    setCash: 0,
    setNetCash: 0,
    setterCommission: 0,
    commission: 0,
  }));
  const highTicketDeals: HighTicketDeal[] = [];

  const addDeal = (deal: {
    id: string;
    kind: HighTicketDeal["kind"];
    date: string | null;
    lead: string | null;
    closer: string | null;
    setterRaw: string | null;
    offer: string | null;
    outcome: string | null;
    cash: number;
    paymentMethod: string | null;
    leadEmail: string | null;
  }) => {
    const { closer, cash, paymentMethod } = deal;
    const setter = deal.setterRaw && !NO_SETTER.test(deal.setterRaw) ? deal.setterRaw : null;
    const financed = Boolean(paymentMethod && FINANCED.test(paymentMethod));
    const processingFee = cash * offer.feeRates.processing;
    const financingFee = financed ? cash * offer.feeRates.financing : 0;
    const feeRate = offer.feeRates.processing + (financed ? offer.feeRates.financing : 0);
    const netCash = cash - processingFee - financingFee;
    const closerCommission = closer ? netCash * HIGH_TICKET_CLOSER_RATE : 0;
    const setterCommission = setter ? netCash * HIGH_TICKET_SETTER_RATE : 0;

    if (closer) {
      const row = highTicket.get(closer);
      row.closedDeals += 1;
      row.closedCash += cash;
      row.closedNetCash += netCash;
      row.closerCommission += closerCommission;
    }
    if (setter) {
      const row = highTicket.get(setter);
      row.setDeals += 1;
      row.setCash += cash;
      row.setNetCash += netCash;
      row.setterCommission += setterCommission;
    }

    const source = paidSplit ? leadSource(deal.leadEmail) : "organic";
    if (source === "paid") addPaid(deal.date, closerCommission + setterCommission);
    if (source === "unmatched") {
      unmatchedLeads.push({
        id: deal.id,
        kind: "high_ticket",
        date: deal.date,
        rep: closer,
        lead: deal.lead,
        email: deal.leadEmail,
        cash,
      });
    }

    highTicketDeals.push({
      id: deal.id,
      kind: deal.kind,
      date: deal.date,
      lead: deal.lead,
      closer,
      setter,
      offer: deal.offer,
      outcome: deal.outcome,
      cashCollected: cash,
      paymentMethod,
      financed,
      feeRate,
      processingFee,
      financingFee,
      netCash,
      closerCommission,
      setterCommission,
      leadEmail: deal.leadEmail,
      leadSource: source,
    });
  };

  for (const r of postCallNoteRecords) {
    const f = r.fields;
    const date = rowEasternDate(f.Date, r.createdTime);
    if (!isDateInRange(date, range)) continue;
    const cash = parseNumericText(f["Cash Collected"]) ?? 0;
    if (cash <= 0) continue;
    addDeal({
      id: r.id,
      kind: "new_deal",
      date,
      lead: text(f["Full Name (Lead)"]),
      closer: text(f["First Name"]),
      setterRaw: text(f["Setters Full Name"]) ?? text(f["Setters Name"]),
      offer: text(f["Offer Pitched On/Closed"]) ?? text(f["Offer Pitched/Closed On"]),
      outcome: text(f["Call Outcome"]),
      cash,
      paymentMethod: text(f["Where Was Payment Collected On"]),
      leadEmail: normalizeEmail(f["Email (Lead)"]),
    });
  }

  for (const r of followUpRecords) {
    const f = r.fields;
    const date = rowEasternDate(f["Payment Collected Date"], r.createdTime);
    if (!isDateInRange(date, range)) continue;
    const cash = parseNumericText(f["Cash Collected"]) ?? 0;
    if (cash <= 0) continue;
    addDeal({
      id: r.id,
      kind: "follow_up",
      date,
      lead: [text(f["Lead First Name"]), text(f["Lead Last Name"])].filter(Boolean).join(" ") || null,
      closer: text(f["Closer Name"]),
      setterRaw: text(f["Setter Name"]),
      offer: text(f["Offer Closed On"]),
      outcome: "Follow Up Payment",
      cash,
      paymentMethod: text(f["Where Was Payment Collected On"]),
      leadEmail: normalizeEmail(f["Lead Email"]),
    });
  }

  const highTicketRows = highTicket.values();
  for (const row of highTicketRows) row.commission = row.closerCommission + row.setterCommission;
  highTicketRows.sort((a, b) => b.commission - a.commission);
  highTicketDeals.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  // ---- Combined, rep by rep ---------------------------------------------
  const combined = new RepIndex<CommissionTotalRow>((rep) => ({
    rep,
    lowTicket: 0,
    highTicketCloser: 0,
    highTicketSetter: 0,
    clawbacks: 0,
    total: 0,
    paid: 0,
  }));
  for (const row of lowTicketRows) {
    const total = combined.get(row.rep);
    total.lowTicket += row.commission;
    total.paid += row.paidCommission;
  }
  for (const deal of highTicketDeals) {
    if (deal.leadSource !== "paid") continue;
    if (deal.closer) combined.get(deal.closer).paid += deal.closerCommission;
    if (deal.setter) combined.get(deal.setter).paid += deal.setterCommission;
  }
  for (const row of highTicketRows) {
    const total = combined.get(row.rep);
    total.highTicketCloser += row.closerCommission;
    total.highTicketSetter += row.setterCommission;
  }
  const clawbacks = allClawbacks.filter((c) => isDateInRange(c.date, range));
  for (const c of clawbacks) combined.get(c.rep).clawbacks += c.amount;
  const byRep = combined.values();
  for (const row of byRep) {
    row.total = row.lowTicket + row.highTicketCloser + row.highTicketSetter - row.clawbacks;
  }
  byRep.sort((a, b) => b.total - a.total);

  const lowTicketTrackedSales = lowTicketRows.reduce((s, r) => s + r.trackedSales, 0);
  const lowTicketSubmittedSales = lowTicketRows.reduce((s, r) => s + r.submittedSales, 0);
  const lowTicketCommission = lowTicketRows.reduce((s, r) => s + r.commission, 0);
  const highTicketCommission = highTicketRows.reduce((s, r) => s + r.commission, 0);
  const clawbackTotal = clawbacks.reduce((s, c) => s + c.amount, 0);
  const paidCommission = byRep.reduce((s, r) => s + r.paid, 0);
  unmatchedLeads.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const response: CommissionsResponse = {
    rates: {
      lowTicket: LOW_TICKET_RATE,
      highTicketCloser: HIGH_TICKET_CLOSER_RATE,
      highTicketSetter: HIGH_TICKET_SETTER_RATE,
      highTicketProcessingFee: offer.feeRates.processing,
      highTicketFinancingFee: offer.feeRates.financing,
    },
    sharedIdTrackingStart: offer.sharedIdTrackingStart,
    totals: {
      commission: lowTicketCommission + highTicketCommission - clawbackTotal,
      lowTicketCommission,
      highTicketCommission,
      lowTicketRealCash: lowTicketRows.reduce((s, r) => s + r.realCash, 0),
      lowTicketSubmittedCash: lowTicketRows.reduce((s, r) => s + r.submittedCash, 0),
      lowTicketSubmittedCommission: lowTicketRows.reduce((s, r) => s + r.submittedCommission, 0),
      lowTicketAttributionRate:
        lowTicketSubmittedSales > 0 ? lowTicketTrackedSales / lowTicketSubmittedSales : null,
      lowTicketTrackedSales,
      lowTicketSubmittedSales,
      unassignedCash,
      unassignedSales,
      highTicketCash: highTicketDeals.reduce((s, d) => s + d.cashCollected, 0),
      highTicketNetCash: highTicketDeals.reduce((s, d) => s + d.netCash, 0),
      highTicketFinancedCash: highTicketDeals.reduce((s, d) => s + (d.financed ? d.cashCollected : 0), 0),
      highTicketProcessingFees: highTicketDeals.reduce((s, d) => s + d.processingFee, 0),
      highTicketFinancingFees: highTicketDeals.reduce((s, d) => s + d.financingFee, 0),
      highTicketCloserCommission: highTicketRows.reduce((s, r) => s + r.closerCommission, 0),
      highTicketSetterCommission: highTicketRows.reduce((s, r) => s + r.setterCommission, 0),
      clawbacks: clawbackTotal,
      paidCommission,
      organicCommission: lowTicketCommission + highTicketCommission - paidCommission,
    },
    paidSplit,
    unmatchedLeads: paidSplit ? unmatchedLeads : [],
    portalSyncedAt,
    clawbacks,
    byRep,
    lowTicket: lowTicketRows,
    highTicket: highTicketRows,
    highTicketDeals,
  };
  return { response, paidByDay };
}
