import { airtableListAll } from "./client";
import { parseDateOnly, parseNumericText } from "./parse";
import { isDateInRange, toEasternDateOnly, type ResolvedRange } from "@/lib/date-range";

/**
 * Sales-team commissions for Bronson, split by ticket size.
 *
 * Low ticket (Base44 / Wix software, setter is full cycle): 10% flat, paid
 * ONLY on real (attributed) cash. Submitted cash is shown for comparison.
 *  - Real cash      = what the affiliate portal actually tracked for the rep's
 *                     Shared ID ("Affiliate Portal By Rep", synced daily by the
 *                     n8n Base44/Wix Attribution Collector; sub_id_2 = the rep).
 *  - Submitted cash = what the rep logged themselves in "Affiliate PCN".
 *
 * High ticket ("Post Call Note"): closer 10%, setter 5% of cash collected
 * after fees (3% processing, or 18% when "Where Was Payment Collected On" is a
 * financing option).
 * A rep who both set and closed the deal gets both (15%).
 */

const BRONSON_BASE_ID = "appiMw8gpaLv2WITA";
const AFFILIATE_PORTAL_BY_REP_TABLE_ID = "tblLc3CJh5lbxAq67";
const AFFILIATE_PCN_TABLE_ID = "tblXsKo89QNuRawBy";
const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";

export const LOW_TICKET_RATE = 0.1;
export const HIGH_TICKET_CLOSER_RATE = 0.1;
export const HIGH_TICKET_SETTER_RATE = 0.05;
/** Fees come off high ticket cash before commission: processing, or financing when the deal was financed. */
export const HIGH_TICKET_PROCESSING_FEE = 0.03;
export const HIGH_TICKET_FINANCING_FEE = 0.18;
const FINANCED = /^financed/i;

/** Portal sales that came through without a Shared ID — nobody is paid on these. */
export const UNASSIGNED_SHARED_ID = "Unassigned";
/** The portal only started stamping Shared IDs on sales from this date. */
export const SHARED_ID_TRACKING_START = "2026-09-08";

const NO_SETTER = /^no setter/i;

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
};

export type HighTicketRepRow = {
  rep: string;
  closedDeals: number;
  closedCash: number;
  closerCommission: number;
  setDeals: number;
  setCash: number;
  setterCommission: number;
  commission: number;
};

export type HighTicketDeal = {
  id: string;
  date: string | null;
  lead: string | null;
  closer: string | null;
  setter: string | null;
  offer: string | null;
  outcome: string | null;
  cashCollected: number;
  paymentMethod: string | null;
  feeRate: number;
  /** Cash collected minus the fee — what commission is paid on. */
  netCash: number;
  closerCommission: number;
  setterCommission: number;
};

export type CommissionTotalRow = {
  rep: string;
  lowTicket: number;
  highTicketCloser: number;
  highTicketSetter: number;
  total: number;
};

export type CommissionsResponse = {
  rates: {
    lowTicket: number;
    highTicketCloser: number;
    highTicketSetter: number;
    highTicketProcessingFee: number;
    highTicketFinancingFee: number;
  };
  sharedIdTrackingStart: string;
  totals: {
    commission: number;
    lowTicketCommission: number;
    highTicketCommission: number;
    lowTicketRealCash: number;
    lowTicketSubmittedCash: number;
    /** Team-wide: portal sales with a Shared ID / Affiliate PCN submissions. */
    lowTicketAttributionRate: number | null;
    lowTicketTrackedSales: number;
    lowTicketSubmittedSales: number;
    unassignedCash: number;
    unassignedSales: number;
    highTicketCash: number;
    highTicketNetCash: number;
  };
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

export async function getBronsonCommissions(range: ResolvedRange): Promise<CommissionsResponse> {
  const [portalRecords, affiliatePcnRecords, postCallNoteRecords] = await Promise.all([
    airtableListAll<Record<string, unknown>>(BRONSON_BASE_ID, AFFILIATE_PORTAL_BY_REP_TABLE_ID),
    airtableListAll<Record<string, unknown>>(BRONSON_BASE_ID, AFFILIATE_PCN_TABLE_ID),
    airtableListAll<Record<string, unknown>>(BRONSON_BASE_ID, POST_CALL_NOTE_TABLE_ID),
  ]);

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
  }));
  let unassignedCash = 0;
  let unassignedSales = 0;

  for (const r of portalRecords) {
    const f = r.fields;
    if (!isDateInRange(parseDateOnly(f.Date), range)) continue;
    const sharedId = text(f["Shared ID"]) ?? UNASSIGNED_SHARED_ID;
    const sales = parseNumericText(f.Purchases) ?? 0;
    const cash = parseNumericText(f.Commission) ?? 0;
    if (sharedId.toLowerCase() === UNASSIGNED_SHARED_ID.toLowerCase()) {
      unassignedSales += sales;
      unassignedCash += cash;
      continue;
    }
    const row = lowTicket.get(sharedId);
    row.realSales += sales;
    row.realCash += cash;
    row.reversedSales += parseNumericText(f["Reversed Purchases"]) ?? 0;
    row.reversedCash += parseNumericText(f["Reversed Commission"]) ?? 0;
  }

  for (const r of affiliatePcnRecords) {
    const f = r.fields;
    if (!isDateInRange(rowEasternDate(f.Date, r.createdTime), range)) continue;
    const rep = text(f["Full Name"]);
    if (!rep) continue;
    const row = lowTicket.get(rep);
    row.submittedSales += 1;
    row.submittedCash += parseNumericText(f["CPA (Payout / Cash Collected)"]) ?? 0;
  }

  const lowTicketRows = lowTicket.values();
  for (const row of lowTicketRows) {
    row.gap = row.realCash - row.submittedCash;
    row.trackedSales = row.realSales + row.reversedSales;
    row.attributionRate = row.submittedSales > 0 ? row.trackedSales / row.submittedSales : null;
    row.commission = row.realCash * LOW_TICKET_RATE;
  }
  lowTicketRows.sort((a, b) => b.realCash - a.realCash || b.submittedCash - a.submittedCash);

  // ---- High ticket ------------------------------------------------------
  const highTicket = new RepIndex<HighTicketRepRow>((rep) => ({
    rep,
    closedDeals: 0,
    closedCash: 0,
    closerCommission: 0,
    setDeals: 0,
    setCash: 0,
    setterCommission: 0,
    commission: 0,
  }));
  const highTicketDeals: HighTicketDeal[] = [];

  for (const r of postCallNoteRecords) {
    const f = r.fields;
    const date = rowEasternDate(f.Date, r.createdTime);
    if (!isDateInRange(date, range)) continue;
    const cash = parseNumericText(f["Cash Collected"]) ?? 0;
    if (cash <= 0) continue;

    const closer = text(f["First Name"]);
    const setterRaw = text(f["Setters Full Name"]) ?? text(f["Setters Name"]);
    const setter = setterRaw && !NO_SETTER.test(setterRaw) ? setterRaw : null;
    const paymentMethod = text(f["Where Was Payment Collected On"]);
    const feeRate =
      paymentMethod && FINANCED.test(paymentMethod)
        ? HIGH_TICKET_FINANCING_FEE
        : HIGH_TICKET_PROCESSING_FEE;
    const netCash = cash * (1 - feeRate);
    const closerCommission = closer ? netCash * HIGH_TICKET_CLOSER_RATE : 0;
    const setterCommission = setter ? netCash * HIGH_TICKET_SETTER_RATE : 0;

    if (closer) {
      const row = highTicket.get(closer);
      row.closedDeals += 1;
      row.closedCash += cash;
      row.closerCommission += closerCommission;
    }
    if (setter) {
      const row = highTicket.get(setter);
      row.setDeals += 1;
      row.setCash += cash;
      row.setterCommission += setterCommission;
    }

    highTicketDeals.push({
      id: r.id,
      date,
      lead: text(f["Full Name (Lead)"]),
      closer,
      setter,
      offer: text(f["Offer Pitched On/Closed"]) ?? text(f["Offer Pitched/Closed On"]),
      outcome: text(f["Call Outcome"]),
      cashCollected: cash,
      paymentMethod,
      feeRate,
      netCash,
      closerCommission,
      setterCommission,
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
    total: 0,
  }));
  for (const row of lowTicketRows) combined.get(row.rep).lowTicket += row.commission;
  for (const row of highTicketRows) {
    const total = combined.get(row.rep);
    total.highTicketCloser += row.closerCommission;
    total.highTicketSetter += row.setterCommission;
  }
  const byRep = combined.values();
  for (const row of byRep) row.total = row.lowTicket + row.highTicketCloser + row.highTicketSetter;
  byRep.sort((a, b) => b.total - a.total);

  const lowTicketTrackedSales = lowTicketRows.reduce((s, r) => s + r.trackedSales, 0);
  const lowTicketSubmittedSales = lowTicketRows.reduce((s, r) => s + r.submittedSales, 0);
  const lowTicketCommission = lowTicketRows.reduce((s, r) => s + r.commission, 0);
  const highTicketCommission = highTicketRows.reduce((s, r) => s + r.commission, 0);

  return {
    rates: {
      lowTicket: LOW_TICKET_RATE,
      highTicketCloser: HIGH_TICKET_CLOSER_RATE,
      highTicketSetter: HIGH_TICKET_SETTER_RATE,
      highTicketProcessingFee: HIGH_TICKET_PROCESSING_FEE,
      highTicketFinancingFee: HIGH_TICKET_FINANCING_FEE,
    },
    sharedIdTrackingStart: SHARED_ID_TRACKING_START,
    totals: {
      commission: lowTicketCommission + highTicketCommission,
      lowTicketCommission,
      highTicketCommission,
      lowTicketRealCash: lowTicketRows.reduce((s, r) => s + r.realCash, 0),
      lowTicketSubmittedCash: lowTicketRows.reduce((s, r) => s + r.submittedCash, 0),
      lowTicketAttributionRate:
        lowTicketSubmittedSales > 0 ? lowTicketTrackedSales / lowTicketSubmittedSales : null,
      lowTicketTrackedSales,
      lowTicketSubmittedSales,
      unassignedCash,
      unassignedSales,
      highTicketCash: highTicketDeals.reduce((s, d) => s + d.cashCollected, 0),
      highTicketNetCash: highTicketDeals.reduce((s, d) => s + d.netCash, 0),
    },
    byRep,
    lowTicket: lowTicketRows,
    highTicket: highTicketRows,
    highTicketDeals,
  };
}
