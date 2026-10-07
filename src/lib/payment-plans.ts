/**
 * Payment Plans tab: every high ticket deal closed on a payment plan, and
 * where each one stands.
 *
 * A plan starts as a Post Call Note with Call Outcome = "Payment Plan": the
 * closer logs the deal size (Total Revenue), what was collected on the call
 * (Cash Collected), how many split pays ("How Many Installments?") and the
 * structure in their own words. Every later installment is a "Follow Up
 * Payment" form entry, matched back to the plan by the lead's email (name as
 * a fallback).
 *
 * Deposits (Call Outcome = "Deposit") are tracked the same way: the balance
 * is the deal size minus the deposit. A deposit is settled once that lead
 * closes (a later Closed or Payment Plan note takes over from it).
 *
 * The next payment is the "Next Payment Date" the closer put on the form.
 * Notes from before that question existed have none, so theirs is assumed:
 * one payment a month from the day the plan started.
 *
 * The tab can also be edited by hand, stored in a "Payment Plan Updates"
 * table (one row per plan, keyed by the Post Call Note the plan started
 * from): the balance can be typed in when a payment went through without a
 * form entry, and a plan can be marked Paid Off or Churned, which takes it
 * off the active list.
 */
import { AirtableError, airtableListAll } from "@/lib/airtable/client";
import { parseDateOnly, parseNumericText } from "@/lib/airtable/parse";
import { addDaysToDateString, easternDateString } from "@/lib/date-range";

// Same table IDs in every offer's base (the bases were cloned from one template).
const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";
const FOLLOW_UP_PAYMENT_TABLE_ID = "tblIv06rB4qG0msnZ";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

export const PAYMENT_PLAN_OFFERS = {
  bronson: {
    baseId: "appiMw8gpaLv2WITA",
    updatesTableId: "tbl1ffNlJM40EyzFh",
    upsellStatusTableId: "tblznQunUKMX2zTVJ",
    // Low ticket sales log, read by the Upsell Potential tab. Column names differ per base.
    affiliatePcn: {
      tableId: "tblXsKo89QNuRawBy",
      repField: "Full Name",
      cashField: "CPA (Payout / Cash Collected)",
    },
  },
  aval: {
    baseId: "appgEcTIxQjmtRKbP",
    updatesTableId: "tblqY5GaHBYTm1vVt",
    upsellStatusTableId: "tbl3Z2nWIR0iGRrEw",
    affiliatePcn: { tableId: "tblFZy89IvQ6Dcsl0", repField: "Your Name", cashField: "CPA?" },
  },
} as const;

export type PaymentPlanOffer = (typeof PAYMENT_PLAN_OFFERS)[keyof typeof PAYMENT_PLAN_OFFERS];

export type PlanPayment = {
  date: string | null;
  amount: number;
  /** "Next Payment Date" logged with this payment, if the closer filled it in. */
  nextDate: string | null;
  /** The call the plan was closed on, or a later Follow Up Payment. */
  kind: "first" | "followUp";
};

export type PaymentPlanStatus = "overdue" | "onTrack" | "paidOff" | "churned";

/** What the tab can set by hand. "Active" puts a plan back on the list. */
export const MANUAL_STATUSES = ["Active", "Paid Off", "Churned"] as const;
export type ManualStatus = (typeof MANUAL_STATUSES)[number];

export type PaymentPlan = {
  id: string;
  kind: "paymentPlan" | "deposit";
  leadName: string | null;
  leadEmail: string | null;
  closer: string | null;
  setter: string | null;
  offer: string | null;
  collectedOn: string | null;
  startDate: string | null;
  /** Split pays as logged on the post call note. */
  installments: number | null;
  structure: string | null;
  total: number | null;
  paid: number;
  /** Null when the note has no Total Revenue to measure against. */
  remaining: number | null;
  /** Day the balance was last typed in by hand on the tab, if it ever was. */
  owedUpdatedOn: string | null;
  payments: PlanPayment[];
  /** Null once paid off. */
  nextDue: string | null;
  /** True when nextDue is the date the closer logged, false when it is the monthly assumption. */
  nextDueLogged: boolean;
  status: PaymentPlanStatus;
  /** Post call notes logged for this same plan (more than 1 = entered twice). */
  timesLogged: number;
};

export type PaymentPlansResponse = {
  plans: PaymentPlan[];
  summary: {
    active: number;
    /** Active ones that are deposits, not payment plans. */
    deposits: number;
    outstanding: number;
    overdue: number;
    overdueAmount: number;
    paidOff: number;
    churned: number;
    /** Balance walked away from on churned plans. */
    churnedAmount: number;
    collected: number;
  };
};

export const text = (raw: unknown): string | null =>
  typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;

export const emailKey = (raw: unknown): string | null => {
  const email = text(raw)?.toLowerCase().replace(/\s/g, "");
  return email && email.includes("@") ? email : null;
};

export const nameKey = (raw: string | null): string | null =>
  raw ? raw.toLowerCase().replace(/\s+/g, " ").trim() || null : null;

/** "2026-01-31" + 1 month = "2026-02-28": the day is clamped to the month's length. */
function addMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return first.toISOString().slice(0, 10);
}

/** The field is a multi-select of "1".."5"; when more than one is ticked the biggest wins. */
function parseInstallments(raw: unknown): number | null {
  const values = (Array.isArray(raw) ? raw : [raw])
    .map((v) => Number.parseInt(String(v), 10))
    .filter((n) => Number.isFinite(n));
  return values.length > 0 ? Math.max(...values) : null;
}

type FollowUp = {
  email: string | null;
  name: string | null;
  date: string | null;
  amount: number;
  nextDate: string | null;
  final: boolean;
};

const STATUS_ORDER: Record<PaymentPlanStatus, number> = {
  overdue: 0,
  onTrack: 1,
  paidOff: 2,
  churned: 3,
};

type PlanUpdate = { amountOwed: number | null; status: ManualStatus | null; date: string | null };

function authHeaders() {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new AirtableError("Missing AIRTABLE_PAT environment variable", 500);
  return { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" };
}

async function airtable<T>(url: string, init: RequestInit = {}): Promise<T> {
  // Never cached: an edit made on the tab must show up right after it's saved.
  const res = await fetch(url, { ...init, headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new AirtableError(`Airtable request failed for ${url} (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

const updatesUrl = (offer: PaymentPlanOffer) =>
  `${AIRTABLE_API_BASE}/${offer.baseId}/${offer.updatesTableId}`;

async function listPlanUpdates(offer: PaymentPlanOffer): Promise<Map<string, PlanUpdate>> {
  const updates = new Map<string, PlanUpdate>();
  let offset: string | undefined;
  do {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const body = await airtable<{
      records: { fields: Record<string, unknown> }[];
      offset?: string;
    }>(`${updatesUrl(offer)}?${qs}`);
    for (const { fields: f } of body.records) {
      const planId = text(f["Plan ID"]);
      if (!planId) continue;
      updates.set(planId, {
        amountOwed: typeof f["Amount Owed"] === "number" ? f["Amount Owed"] : null,
        status: MANUAL_STATUSES.find((s) => s === f.Status) ?? null,
        date: parseDateOnly(f.Updated),
      });
    }
    offset = body.offset;
  } while (offset);
  return updates;
}

/**
 * Saves a hand edit for one plan (its row is created on the first edit).
 * Only what is passed changes: a new balance leaves the status alone and the
 * other way round.
 */
export async function savePlanUpdate(
  offer: PaymentPlanOffer,
  input: { planId: string; lead: string; amountOwed?: number; status?: ManualStatus }
) {
  await airtable(updatesUrl(offer), {
    method: "PATCH",
    body: JSON.stringify({
      performUpsert: { fieldsToMergeOn: ["Plan ID"] },
      records: [
        {
          fields: {
            "Plan ID": input.planId,
            Lead: input.lead,
            ...(input.amountOwed !== undefined
              ? { "Amount Owed": input.amountOwed, Updated: easternDateString() }
              : {}),
            ...(input.status !== undefined ? { Status: input.status } : {}),
          },
        },
      ],
    }),
  });
}

export async function getPaymentPlans(offer: PaymentPlanOffer): Promise<PaymentPlansResponse> {
  const [noteRecords, followUpRecords, updates] = await Promise.all([
    airtableListAll<Record<string, unknown>>(offer.baseId, POST_CALL_NOTE_TABLE_ID, {
      // Closed notes are only read to settle the deposits that came before them.
      filterByFormula: `OR({Call Outcome}='Payment Plan',{Call Outcome}='Deposit',{Call Outcome}='Closed (PIF)')`,
    }),
    airtableListAll<Record<string, unknown>>(offer.baseId, FOLLOW_UP_PAYMENT_TABLE_ID),
    listPlanUpdates(offer),
  ]);

  const followUps: FollowUp[] = [];
  for (const r of followUpRecords) {
    const f = r.fields;
    const amount = parseNumericText(f["Cash Collected"]);
    if (!amount) continue;
    followUps.push({
      email: emailKey(f["Lead Email"]),
      name: nameKey([text(f["Lead First Name"]), text(f["Lead Last Name"])].filter(Boolean).join(" ")),
      date: parseDateOnly(f["Payment Collected Date"]),
      amount,
      nextDate: parseDateOnly(f["Next Payment Date"]),
      final: f["Is This The Final Payment For The Customer"] === "Yes",
    });
  }

  // The same deal sometimes gets a second post call note (another rep logging
  // it again): same lead + same deal size is one plan, and the earliest note
  // is the one that counts.
  const notes = noteRecords
    .map((r) => ({ id: r.id, f: r.fields, date: parseDateOnly(r.fields.Date) }))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const byKey = new Map<string, { plan: PaymentPlan; email: string | null; name: string | null }>();
  // Lead -> day of their latest full deal (Closed or Payment Plan), which settles earlier deposits.
  const lastDeal = new Map<string, string>();
  for (const { id, f, date } of notes) {
    const leadName = text(f["Full Name (Lead)"]);
    const email = emailKey(f["Email (Lead)"]);
    const name = nameKey(leadName);
    const total = parseNumericText(f["Total Revenue"]);
    const outcome = f["Call Outcome"];
    if (outcome !== "Deposit" && date) lastDeal.set(email ?? name ?? id, date);
    if (outcome === "Closed (PIF)") continue;
    const kind = outcome === "Deposit" ? "deposit" : "paymentPlan";
    const key = `${email ?? name ?? id}|${kind}|${total ?? ""}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.plan.timesLogged += 1;
      continue;
    }
    const first = parseNumericText(f["Cash Collected"]) ?? 0;
    byKey.set(key, {
      email,
      name,
      plan: {
        id,
        kind,
        leadName,
        leadEmail: email,
        closer: text(f["First Name"]),
        setter: text(f["Setters Full Name"]) ?? text(f["Setters Name"]),
        offer: text(f["Offer Pitched On/Closed"]),
        collectedOn: text(f["Where Was Payment Collected On"]),
        startDate: date,
        installments: parseInstallments(f["How Many Installments?"]),
        structure: text(f["What is the structure of the split?"]),
        total,
        paid: first,
        remaining: null,
        owedUpdatedOn: null,
        payments: [
          { date, amount: first, nextDate: parseDateOnly(f["Next Payment Date"]), kind: "first" },
        ],
        nextDue: null,
        nextDueLogged: false,
        status: "onTrack",
        timesLogged: 1,
      },
    });
  }

  // Each follow up payment lands on that lead's latest plan started on or before it.
  const entries = [...byKey.values()];
  const finals = new Set<string>();
  for (const fu of followUps) {
    const match = entries
      .filter(
        (e) =>
          ((fu.email && e.email === fu.email) || (fu.name && e.name === fu.name)) &&
          (!fu.date || !e.plan.startDate || e.plan.startDate <= fu.date)
      )
      .at(-1);
    if (!match) continue;
    match.plan.payments.push({
      date: fu.date,
      amount: fu.amount,
      nextDate: fu.nextDate,
      kind: "followUp",
    });
    match.plan.paid += fu.amount;
    if (fu.final) finals.add(match.plan.id);
  }

  const today = easternDateString();
  const plans = entries.map(({ plan, email, name }) => {
    const closedOn = lastDeal.get(email ?? name ?? plan.id);
    const depositClosed =
      plan.kind === "deposit" && closedOn !== undefined && closedOn > (plan.startDate ?? "");
    plan.payments.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    plan.remaining = plan.total === null ? null : Math.max(0, plan.total - plan.paid);
    const update = updates.get(plan.id);
    // A balance typed in on the tab wins over the form math; follow up
    // payments logged after that day still come off it.
    if (update && update.amountOwed !== null) {
      const since = update.date;
      const paidSince = plan.payments
        .filter((p) => p.kind === "followUp" && since !== null && p.date !== null && p.date > since)
        .reduce((t, p) => t + p.amount, 0);
      plan.remaining = Math.max(0, update.amountOwed - paidSince);
      plan.owedUpdatedOn = since;
      if (plan.total !== null) plan.paid = Math.max(0, plan.total - plan.remaining);
    }
    if (update?.status === "Churned") {
      plan.status = "churned";
    } else if (
      update?.status === "Paid Off" ||
      // "Active" set by hand keeps a deposit on the list even after the lead closed.
      (depositClosed && update?.status !== "Active") ||
      finals.has(plan.id) ||
      plan.remaining === 0
    ) {
      plan.status = "paidOff";
      plan.remaining = plan.remaining === null ? null : 0;
      if (plan.total !== null) plan.paid = Math.max(plan.paid, plan.total);
    } else {
      // The date the closer logged with the latest payment wins, unless a
      // payment has landed since (then it is stale and the monthly rule takes over).
      const last = plan.payments.at(-1);
      const logged = last?.nextDate && last.nextDate > (last.date ?? "") ? last.nextDate : null;
      plan.nextDueLogged = logged !== null;
      const byPayments =
        logged ?? (plan.startDate ? addMonths(plan.startDate, plan.payments.length) : null);
      // A hand-updated balance means a payment just landed: the next one is a month out from it.
      const byUpdate = plan.owedUpdatedOn ? addMonths(plan.owedUpdatedOn, 1) : null;
      plan.nextDue =
        byPayments && byUpdate ? (byUpdate > byPayments ? byUpdate : byPayments) : (byUpdate ?? byPayments);
      if (plan.nextDue !== byPayments) plan.nextDueLogged = false;
      plan.status = plan.nextDue !== null && plan.nextDue < today ? "overdue" : "onTrack";
    }
    return plan;
  });

  plans.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.status === "paidOff" || a.status === "churned"
        ? (b.startDate ?? "").localeCompare(a.startDate ?? "")
        : (a.nextDue ?? "9999").localeCompare(b.nextDue ?? "9999"))
  );

  const open = plans.filter((p) => p.status === "overdue" || p.status === "onTrack");
  const overdue = plans.filter((p) => p.status === "overdue");
  const churned = plans.filter((p) => p.status === "churned");
  const sum = (list: PaymentPlan[], pick: (p: PaymentPlan) => number | null) =>
    list.reduce((t, p) => t + (pick(p) ?? 0), 0);
  return {
    plans,
    summary: {
      active: open.length,
      deposits: open.filter((p) => p.kind === "deposit").length,
      outstanding: sum(open, (p) => p.remaining),
      overdue: overdue.length,
      overdueAmount: sum(overdue, (p) => p.remaining),
      paidOff: plans.filter((p) => p.status === "paidOff").length,
      churned: churned.length,
      churnedAmount: sum(churned, (p) => p.remaining),
      collected: sum(plans, (p) => p.paid),
    },
  };
}

/** Active plans and deposits whose next payment is due exactly `daysAhead` days from today (Eastern). */
export async function getPlansDue(offer: PaymentPlanOffer, daysAhead: number) {
  const date = addDaysToDateString(easternDateString(), daysAhead);
  const { plans } = await getPaymentPlans(offer);
  return {
    date,
    plans: plans.filter(
      (p) => (p.status === "onTrack" || p.status === "overdue") && p.nextDue === date
    ),
  };
}
