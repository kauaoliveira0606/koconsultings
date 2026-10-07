/**
 * Upsell Potential tab: every customer who has bought, one row each: the
 * people an upsell can be pitched to. Split in two lists.
 *
 * High ticket: a deal is a Post Call Note with Call Outcome = Deposit,
 * Payment Plan or Closed (PIF). Deals are grouped per customer by the lead's
 * email (name as a fallback), newest first. Cash is what was collected on
 * those calls plus any Follow Up Payment form entries for the same lead.
 *
 * Renewals (offers with access rules only): when each high ticket buyer's
 * access to the program runs out, so they can be renewed or upsold. The end
 * date is the purchase date plus the months their package gives.
 *
 * Low ticket: everyone in the Affiliate PCN (software sales), grouped the
 * same way. The same sale entered twice (same email, same name, same
 * software) is a duplicate: the latest entry is kept. Nobody is on both lists: a low ticket buyer who also bought high
 * ticket only shows under high ticket.
 */
import { airtableListAll } from "@/lib/airtable/client";
import { parseDateOnly, parseNumericText } from "@/lib/airtable/parse";
import { easternDateString, toEasternDateOnly } from "@/lib/date-range";
import { listUpsellStatuses, type UpsellStatus, type UpsellStatusEntry } from "@/lib/upsell-status";
import {
  addMonths,
  emailKey,
  getPaymentPlans,
  nameKey,
  text,
  type AccessRules,
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
  /** "Where Was Payment Collected On": Whop, Stripe, Financed (Clarity), ... */
  paidVia: string | null;
  notes: string | null;
  fathomLink: string | null;
};

/** Where the customer stands on the upsell, set by hand on the tab. */
type Worked = { key: string; status: UpsellStatus; statusNote: string | null; statusUpdated: string | null };

const NOT_WORKED = { status: "Not Contacted", statusNote: null, statusUpdated: null } as const;

const worked = (entry: UpsellStatusEntry | undefined) =>
  entry
    ? { status: entry.status, statusNote: entry.note, statusUpdated: entry.updated }
    : NOT_WORKED;

export type UpsellCustomer = Worked & {
  id: string;
  name: string | null;
  email: string | null;
  /** Newest first. */
  deals: UpsellDeal[];
  lastPurchase: string | null;
  cashCollected: number;
  dealValue: number;
  /** Already took an upsell: a deal logged as an Upsell, or on the top tier (Upsell/Premium, Mastermind). */
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

export type LowTicketCustomer = Worked & {
  id: string;
  name: string | null;
  email: string | null;
  /** Newest first. */
  sales: LowTicketSale[];
  lastPurchase: string | null;
  cashCollected: number;
  /** Any of their sales was logged with a high ticket call booked. */
  bookedCall: boolean;
  /** Bought a yearly plan: the strongest buying signal on this list. */
  yearly: boolean;
};

export type RenewalState = "expired" | "endingSoon" | "active";

/** Access ending within this many days counts as "ending soon". */
export const RENEWAL_SOON_DAYS = 30;

export type RenewalCustomer = Worked & {
  id: string;
  name: string | null;
  email: string | null;
  /** The package their access runs on (the one that ends last, if they bought more than once). */
  packageName: string;
  months: number;
  purchased: string;
  accessEnds: string;
  /** Negative once access has ended. */
  daysLeft: number;
  state: RenewalState;
  closer: string | null;
  cashCollected: number;
};

export type Renewals = {
  /** Soonest to end (or longest expired) first. */
  customers: RenewalCustomer[];
  summary: {
    tracked: number;
    expired: number;
    endingSoon: number;
    /** Buyers from before the access rules started: lifetime access, not tracked. */
    lifetime: number;
    /** Buyers since then whose package has no access length set. */
    noRule: number;
    from: string;
  };
};

export type UpsellPotentialResponse = {
  /** Null for offers with no access rules yet. */
  renewals: Renewals | null;
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
      /** Affiliate PCN entries dropped as a repeat of a later one. */
      duplicatesRemoved: number;
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
  highTicket: { emails: Set<string>; names: Set<string> },
  statuses: Map<string, UpsellStatusEntry>
): UpsellPotentialResponse["lowTicket"] {
  const { repField, cashField } = offer.affiliatePcn;
  const rows = records
    .map((r) => {
      // The two bases spell these columns with different capitals.
      const f = Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k.toLowerCase(), v]));
      return {
        id: r.id,
        created: r.createdTime,
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
    .sort(
      (a, b) =>
        (a.sale.date ?? "").localeCompare(b.sale.date ?? "") || a.created.localeCompare(b.created)
    );

  const byCustomer = new Map<string, LowTicketCustomer>();
  const moved = new Set<string>();
  // Customer -> "name|software" -> the sale kept for it (the latest entry wins).
  const kept = new Map<LowTicketCustomer, Map<string, LowTicketSale>>();
  let duplicatesRemoved = 0;
  for (const { id, name, email, sale } of rows) {
    const full = fullNameKey(name);
    const key = email ?? full ?? id;
    if ((email && highTicket.emails.has(email)) || (full && highTicket.names.has(full))) {
      moved.add(key);
      continue;
    }
    const customer = byCustomer.get(key) ?? {
      id,
      key,
      ...worked(statuses.get(key)),
      name,
      email,
      sales: [],
      lastPurchase: null,
      cashCollected: 0,
      bookedCall: false,
      yearly: false,
    };
    const sales = kept.get(customer) ?? new Map<string, LowTicketSale>();
    const saleKey = `${nameKey(name) ?? ""}|${sale.software?.toLowerCase() ?? ""}`;
    if (email && sales.has(saleKey)) duplicatesRemoved += 1;
    // Rows without an email can't be told apart from a repeat, so they all stay.
    sales.set(email ? saleKey : sale.id, sale);
    kept.set(customer, sales);
    if (name && name.length > (customer.name?.length ?? 0)) customer.name = name;
    byCustomer.set(key, customer);
  }
  for (const [customer, sales] of kept) {
    customer.sales = [...sales.values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    customer.lastPurchase = customer.sales[0]?.date ?? null;
    customer.cashCollected = customer.sales.reduce((t, s) => t + s.cash, 0);
    customer.bookedCall = customer.sales.some((s) => s.bookedCall);
    customer.yearly = customer.sales.some((s) => s.plan === "Yearly");
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
      duplicatesRemoved,
    },
  };
}

function renewals(customers: UpsellCustomer[], rules: AccessRules): Renewals {
  const today = easternDateString();
  const tracked: RenewalCustomer[] = [];
  let lifetime = 0;
  let noRule = 0;
  for (const c of customers) {
    // A deposit alone isn't access: only full deals (paid in full or on a plan) count.
    const deals = c.deals.filter((d) => d.type !== "deposit" && d.date !== null);
    const since = deals.filter((d) => (d.date as string) >= rules.from);
    if (since.length === 0) {
      if (deals.length > 0) lifetime += 1;
      continue;
    }
    // Someone who also bought before the cutoff already has lifetime access.
    if (deals.length > since.length) {
      lifetime += 1;
      continue;
    }
    // Churned means removed from the program: nothing to renew.
    if (c.churned) continue;
    const dated = since.flatMap((d) => {
      const rule = rules.packages.find((p) => p.match.test(d.offer ?? ""));
      return rule ? [{ deal: d, months: rule.months, ends: addMonths(d.date as string, rule.months) }] : [];
    });
    if (dated.length === 0) {
      noRule += 1;
      continue;
    }
    const last = dated.reduce((a, b) => (b.ends > a.ends ? b : a));
    const daysLeft = Math.round(
      (Date.parse(`${last.ends}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000
    );
    tracked.push({
      id: c.id,
      key: c.key,
      status: c.status,
      statusNote: c.statusNote,
      statusUpdated: c.statusUpdated,
      name: c.name,
      email: c.email,
      packageName: last.deal.offer as string,
      months: last.months,
      purchased: last.deal.date as string,
      accessEnds: last.ends,
      daysLeft,
      state: daysLeft < 0 ? "expired" : daysLeft <= RENEWAL_SOON_DAYS ? "endingSoon" : "active",
      closer: last.deal.closer,
      cashCollected: c.cashCollected,
    });
  }
  tracked.sort((a, b) => a.accessEnds.localeCompare(b.accessEnds));
  return {
    customers: tracked,
    summary: {
      tracked: tracked.length,
      expired: tracked.filter((r) => r.state === "expired").length,
      endingSoon: tracked.filter((r) => r.state === "endingSoon").length,
      lifetime,
      noRule,
      from: rules.from,
    },
  };
}

export async function getUpsellPotential(offer: PaymentPlanOffer): Promise<UpsellPotentialResponse> {
  const [noteRecords, followUpRecords, plans, affiliateRecords, statuses] = await Promise.all([
    airtableListAll<Record<string, unknown>>(offer.baseId, POST_CALL_NOTE_TABLE_ID, {
      filterByFormula: `OR(${Object.keys(OUTCOMES)
        .map((o) => `{Call Outcome}='${o}'`)
        .join(",")})`,
    }),
    airtableListAll<Record<string, unknown>>(offer.baseId, FOLLOW_UP_PAYMENT_TABLE_ID),
    getPaymentPlans(offer),
    airtableListAll<Record<string, unknown>>(offer.baseId, offer.affiliatePcn.tableId),
    listUpsellStatuses(offer),
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
      key,
      ...worked(statuses.get(key)),
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
      paidVia: text(f["Where Was Payment Collected On"]),
      notes: text(f["Prospect Notes"]),
      fathomLink: text(f["Fathom Link"]),
    });
    customer.lastPurchase = date ?? customer.lastPurchase;
    // Reps sometimes log just a first name: keep the fullest one.
    if (name && name.length > (customer.name?.length ?? 0)) customer.name = name;
    customer.cashCollected += cash;
    customer.dealValue += revenue ?? 0;
    customer.upsold ||= typeOfClose === "Upsell" || /^(upsell|mastermind)/i.test(offerName ?? "");
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
    renewals: offer.access ? renewals(customers, offer.access) : null,
    lowTicket: lowTicketCustomers(offer, affiliateRecords, highTicket, statuses),
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
