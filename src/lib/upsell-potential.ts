/**
 * Upsell Potential tab: every customer who has bought, one row each: the
 * people an upsell can be pitched to. Split in two lists.
 *
 * High ticket: a deal is a Post Call Note with Call Outcome = Deposit,
 * Payment Plan or Closed (PIF). Deals are grouped per customer by the lead's
 * email (name as a fallback), newest first. Cash is what was collected on
 * those calls plus any Follow Up Payment form entries for the same lead.
 *
 * Low ticket: everyone in the Affiliate PCN (software sales), grouped the
 * same way. Nobody is on both lists: a low ticket buyer who also bought high
 * ticket only shows under high ticket.
 */
import { airtableListAll } from "@/lib/airtable/client";
import { parseDateOnly, parseNumericText } from "@/lib/airtable/parse";
import { toEasternDateOnly } from "@/lib/date-range";
import {
  emailKey,
  getPaymentPlans,
  nameKey,
  text,
  type PaymentPlanOffer,
} from "@/lib/payment-plans";

// Same table IDs in every offer's base (the bases were cloned from one template).
const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";
const FOLLOW_UP_PAYMENT_TABLE_ID = "tblIv06rB4qG0msnZ";

const OUTCOMES = {
  Deposit: "deposit",
  "Payment Plan": "paymentPlan",
  "Closed (PIF)": "closed",
} as const;

export type DealType = (typeof OUTCOMES)[keyof typeof OUTCOMES];

export type UpsellDeal = {
  id: string;
  date: string | null;
  type: DealType;
  offer: string | null;
  typeOfClose: string | null;
  closer: string | null;
  setter: string | null;
  cash: number;
  revenue: number | null;
  notes: string | null;
  fathomLink: string | null;
};

export type UpsellCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  /** Newest first. */
  deals: UpsellDeal[];
  lastPurchase: string | null;
  cashCollected: number;
  dealValue: number;
  /** Already took an upsell: a deal logged as an Upsell, or on the Upsell/Premium tier. */
  upsold: boolean;
  /** Marked churned on the Payment Plans tab. */
  churned: boolean;
};

export type LowTicketSale = {
  id: string;
  date: string | null;
  software: string | null;
  plan: string | null;
  rep: string | null;
  cash: number;
  bookedCall: boolean;
  fathomLink: string | null;
};

export type LowTicketCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  /** Newest first. */
  sales: LowTicketSale[];
  lastPurchase: string | null;
  cashCollected: number;
  /** Any of their sales was logged with a high ticket call booked. */
  bookedCall: boolean;
};

export type UpsellPotentialResponse = {
  customers: UpsellCustomer[];
  summary: {
    customers: number;
    closed: number;
    paymentPlans: number;
    deposits: number;
    cashCollected: number;
    dealValue: number;
  };
  lowTicket: {
    customers: LowTicketCustomer[];
    summary: {
      customers: number;
      bookedCall: number;
      noCall: number;
      cashCollected: number;
      /** Low ticket buyers left off this list because they are on the high ticket one. */
      alsoHighTicket: number;
    };
  };
};

/** A name is only trusted for matching when it is a full one: "z" or "lorenzo" would collide. */
const fullNameKey = (raw: string | null): string | null => {
  const key = nameKey(raw);
  return key && key.includes(" ") ? key : null;
};

function lowTicketCustomers(
  offer: PaymentPlanOffer,
  records: { id: string; createdTime: string; fields: Record<string, unknown> }[],
  highTicket: { emails: Set<string>; names: Set<string> }
): UpsellPotentialResponse["lowTicket"] {
  const { repField, cashField } = offer.affiliatePcn;
  const rows = records
    .map((r) => {
      // The two bases spell these columns with different capitals.
      const f = Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k.toLowerCase(), v]));
      return {
        id: r.id,
        name: text(f["lead name"]),
        email: emailKey(f["lead email"]),
        sale: {
          id: r.id,
          date: parseDateOnly(f.date) ?? toEasternDateOnly(r.createdTime),
          software: text(f["which software"]),
          plan: text(f["plan?"]),
          rep: text(f[repField.toLowerCase()]),
          cash: parseNumericText(f[cashField.toLowerCase()]) ?? 0,
          bookedCall: f["booked high ticket call?"] === "Yes",
          fathomLink: text(f["fathom link"]),
        },
      };
    })
    .sort((a, b) => (a.sale.date ?? "").localeCompare(b.sale.date ?? ""));

  const byCustomer = new Map<string, LowTicketCustomer>();
  const moved = new Set<string>();
  for (const { id, name, email, sale } of rows) {
    const full = fullNameKey(name);
    const key = email ?? full ?? id;
    if ((email && highTicket.emails.has(email)) || (full && highTicket.names.has(full))) {
      moved.add(key);
      continue;
    }
    const customer = byCustomer.get(key) ?? {
      id,
      name,
      email,
      sales: [],
      lastPurchase: null,
      cashCollected: 0,
      bookedCall: false,
    };
    customer.sales.unshift(sale);
    customer.lastPurchase = sale.date ?? customer.lastPurchase;
    customer.cashCollected += sale.cash;
    customer.bookedCall ||= sale.bookedCall;
    if (name && name.length > (customer.name?.length ?? 0)) customer.name = name;
    byCustomer.set(key, customer);
  }

  const customers = [...byCustomer.values()].sort((a, b) =>
    (b.lastPurchase ?? "").localeCompare(a.lastPurchase ?? "")
  );
  const booked = customers.filter((c) => c.bookedCall).length;
  return {
    customers,
    summary: {
      customers: customers.length,
      bookedCall: booked,
      noCall: customers.length - booked,
      cashCollected: customers.reduce((t, c) => t + c.cashCollected, 0),
      alsoHighTicket: moved.size,
    },
  };
}

export async function getUpsellPotential(offer: PaymentPlanOffer): Promise<UpsellPotentialResponse> {
  const [noteRecords, followUpRecords, plans, affiliateRecords] = await Promise.all([
    airtableListAll<Record<string, unknown>>(offer.baseId, POST_CALL_NOTE_TABLE_ID, {
      filterByFormula: `OR(${Object.keys(OUTCOMES)
        .map((o) => `{Call Outcome}='${o}'`)
        .join(",")})`,
    }),
    airtableListAll<Record<string, unknown>>(offer.baseId, FOLLOW_UP_PAYMENT_TABLE_ID),
    getPaymentPlans(offer),
    airtableListAll<Record<string, unknown>>(offer.baseId, offer.affiliatePcn.tableId),
  ]);

  const notes = noteRecords
    .map((r) => ({ id: r.id, f: r.fields, date: parseDateOnly(r.fields.Date) }))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const byCustomer = new Map<string, UpsellCustomer>();
  const nameKeys = new Map<UpsellCustomer, string | null>();
  // The same deal sometimes gets a second post call note: same lead, same
  // outcome and same deal size counts once (the earliest note).
  const seenDeals = new Set<string>();
  for (const { id, f, date } of notes) {
    const type = OUTCOMES[f["Call Outcome"] as keyof typeof OUTCOMES];
    if (!type) continue;
    const name = text(f["Full Name (Lead)"]);
    const email = emailKey(f["Email (Lead)"]);
    const key = email ?? nameKey(name) ?? id;
    const revenue = parseNumericText(f["Total Revenue"]);
    const dealKey = `${key}|${type}|${revenue ?? ""}`;
    if (seenDeals.has(dealKey)) continue;
    seenDeals.add(dealKey);

    const customer = byCustomer.get(key) ?? {
      id,
      name,
      email,
      deals: [],
      lastPurchase: null,
      cashCollected: 0,
      dealValue: 0,
      upsold: false,
      churned: false,
    };
    const offerName = text(f["Offer Pitched On/Closed"]);
    const typeOfClose = text(f["Type Of Close"]);
    const cash = parseNumericText(f["Cash Collected"]) ?? 0;
    customer.deals.unshift({
      id,
      date,
      type,
      offer: offerName,
      typeOfClose,
      closer: text(f["First Name"]),
      setter: text(f["Setters Full Name"]) ?? text(f["Setters Name"]),
      cash,
      revenue,
      notes: text(f["Prospect Notes"]),
      fathomLink: text(f["Fathom Link"]),
    });
    customer.lastPurchase = date ?? customer.lastPurchase;
    // Reps sometimes log just a first name: keep the fullest one.
    if (name && name.length > (customer.name?.length ?? 0)) customer.name = name;
    customer.cashCollected += cash;
    customer.dealValue += revenue ?? 0;
    customer.upsold ||= typeOfClose === "Upsell" || (offerName?.startsWith("Upsell") ?? false);
    byCustomer.set(key, customer);
    if (!nameKeys.has(customer)) nameKeys.set(customer, nameKey(name));
  }

  const customers = [...byCustomer.values()];
  for (const r of followUpRecords) {
    const f = r.fields;
    const amount = parseNumericText(f["Cash Collected"]);
    if (!amount) continue;
    const email = emailKey(f["Lead Email"]);
    const name = nameKey(
      [text(f["Lead First Name"]), text(f["Lead Last Name"])].filter(Boolean).join(" ")
    );
    const customer = customers.find(
      (c) => (email && c.email === email) || (name && nameKeys.get(c) === name)
    );
    if (customer) customer.cashCollected += amount;
  }

  const churned = new Set(
    plans.plans.filter((p) => p.status === "churned").map((p) => p.leadEmail ?? p.id)
  );
  for (const c of customers) {
    c.churned = c.deals.some((d) => churned.has(d.id)) || (c.email !== null && churned.has(c.email));
  }

  customers.sort((a, b) => (b.lastPurchase ?? "").localeCompare(a.lastPurchase ?? ""));

  const has = (type: DealType) => customers.filter((c) => c.deals.some((d) => d.type === type)).length;
  const highTicket = {
    emails: new Set(customers.flatMap((c) => (c.email ? [c.email] : []))),
    names: new Set(customers.flatMap((c) => fullNameKey(c.name) ?? [])),
  };
  return {
    lowTicket: lowTicketCustomers(offer, affiliateRecords, highTicket),
    customers,
    summary: {
      customers: customers.length,
      closed: has("closed"),
      paymentPlans: has("paymentPlan"),
      deposits: has("deposit"),
      cashCollected: customers.reduce((t, c) => t + c.cashCollected, 0),
      dealValue: customers.reduce((t, c) => t + c.dealValue, 0),
    },
  };
}
