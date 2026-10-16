/**
 * The 6 AM EOD totals post, sent to each offer's #eod-report:
 *
 * - Totals: every EOD Closer and Affiliate EOD filed for yesterday, summed.
 * - Paid / Organic: the EOD forms don't record where a call came from, so the
 *   split is built per call. A call = a Calendly sales call that happened
 *   yesterday or a Post Call Note with Call Taken yesterday (one per lead
 *   email). Its source is the lead's GHL tag, or the Leads table Source when
 *   the contact has no tag. Showed / Closed come from that lead's Post Call
 *   Note outcome. The split covers only the calls we can see, so it can sum
 *   to less than the EOD totals; the gap is shown, not hidden.
 */
import { airtableListFresh } from "@/lib/airtable/client";
import { getAvalLeads } from "@/lib/airtable/tables-aval";
import { getLeads } from "@/lib/airtable/tables";
import { getCallsOnDate } from "@/lib/calendly";
import { calendlyFor, type CalendlyOffer } from "@/lib/calendly-offers";
import { addDaysToDateString } from "@/lib/date-range";

type Source = "paid" | "organic" | "unknown";

const OFFERS: Record<
  CalendlyOffer,
  {
    baseId: string;
    setterEodTableId: string;
    ghlEnv: { pit: string; location: string };
    /** Exact GHL tags (lowercase) that mark a lead's source. */
    tags: { paid: string; organic: string };
    getLeads: () => Promise<{ email: string | null; source: string | null }[]>;
    /** Affiliate EOD column names, which differ per base. */
    setter: Record<
      | "dials"
      | "pickups"
      | "talkTime"
      | "softwarePitched"
      | "softwareClosed"
      | "htPitched"
      | "htBooked"
      | "selfBookedToReach"
      | "selfBookedConnected"
      | "setClosed"
      | "affiliateCash"
      | "htCash",
      string
    >;
  }
> = {
  bronson: {
    baseId: "appiMw8gpaLv2WITA",
    setterEodTableId: "tblezCVnizBHKPL4Q",
    ghlEnv: { pit: "GHL_BRONSON_PIT", location: "GHL_BRONSON_LOCATION_ID" },
    tags: { paid: "base44 paid", organic: "base44 organic" },
    getLeads,
    setter: {
      dials: "Outbound dials",
      pickups: "Pick ups",
      talkTime: "total talk time",
      softwarePitched: "Software pitched",
      softwareClosed: "software closed",
      htPitched: "high ticket call pitched",
      htBooked: "new high ticket calls booked",
      selfBookedToReach: "Self-booked calls to reach out to",
      selfBookedConnected: "Self-booked leads connected",
      setClosed: "set closed",
      affiliateCash: "Cash collected affiliate",
      htCash: "cash collected high ticket",
    },
  },
  aval: {
    baseId: "appgEcTIxQjmtRKbP",
    setterEodTableId: "tblMsNIo5ZbNECcSv",
    ghlEnv: { pit: "GHL_AVAL_PIT", location: "GHL_AVAL_LOCATION_ID" },
    tags: { paid: "paid", organic: "organic" },
    getLeads: getAvalLeads,
    setter: {
      dials: "Outbound dials",
      pickups: "Pick ups",
      talkTime: "Total talk time",
      softwarePitched: "Software pitched",
      softwareClosed: "Software closes",
      htPitched: "Pitched high ticket calls",
      htBooked: "New high ticket calls booked",
      selfBookedToReach: "Self-booked calls to reach out to",
      selfBookedConnected: "Self-booked leads connected",
      setClosed: "High ticket set closes",
      affiliateCash: "Cash collected Affiliate",
      htCash: "Cash collected High Ticket",
    },
  },
};

// Same IDs in both bases (cloned from one template).
const EOD_CLOSER_TABLE_ID = "tbl0xIvtCZIjemZRZ";
const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";

const CLOSER_FIELDS = {
  booked: "Calls Booked",
  showed: "Calls Showed",
  cancelled: "Cancelled Calls",
  reschedules: "Reschedules",
  dq: "Disqualified Calls",
  offers: "Offers Made",
  closed: "Deals Closed",
  deposits: "Deposits",
  cash: "Total Cash Collected",
  revenue: "Total Revenue",
  depositsCash: "Deposits Cash Collected",
  followUpPayments: "Follow Up Payments",
  aiSales: "Bronson AI Sales",
  aiCash: "Bronson AI Cash Collected",
} as const;

// Post Call Note outcomes. Anything not listed (No Close, Disqualified,
// Deposit, Payment Dipped...) still means the lead showed up.
const NOT_SHOWED = /no show|reschedul|cancel/i;
const CLOSED = /closed|payment plan/i;

type Split = Record<Source, number>;
const emptySplit = (): Split => ({ paid: 0, organic: 0, unknown: 0 });

export type DailyEodSummary = {
  date: string;
  filed: { closers: string[]; setters: string[] };
  closer: Record<keyof typeof CLOSER_FIELDS, number>;
  setter: Record<keyof (typeof OFFERS)["bronson"]["setter"], number>;
  split: { calls: number; booked: Split; showed: Split; closed: Split };
  /** Set when Calendly or GHL couldn't be read; the totals still post. */
  splitError: string | null;
};

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const norm = (s: string) => s.trim().toLowerCase();

async function rowsOn(baseId: string, tableId: string, date: string) {
  return airtableListFresh<Record<string, unknown>>(baseId, tableId, {
    filterByFormula: `DATETIME_FORMAT({Date}, 'YYYY-MM-DD') = '${date}'`,
  });
}

function sum<K extends string>(rows: { fields: Record<string, unknown> }[], fields: Record<K, string>) {
  const out = {} as Record<K, number>;
  for (const key of Object.keys(fields) as K[]) {
    out[key] = rows.reduce<number>((t, r) => t + num(r.fields[fields[key]]), 0);
  }
  return out;
}

/** The lead's source from its GHL tags; null when it has neither tag. */
async function ghlSource(offer: CalendlyOffer, email: string): Promise<Source | null> {
  const { ghlEnv, tags } = OFFERS[offer];
  const pit = process.env[ghlEnv.pit];
  const locationId = process.env[ghlEnv.location];
  if (!pit || !locationId) throw new Error(`Missing ${ghlEnv.pit} / ${ghlEnv.location}`);
  const res = await fetch("https://services.leadconnectorhq.com/contacts/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pit}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
      // GHL rejects requests without a browser User-Agent.
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
    body: JSON.stringify({
      locationId,
      pageLimit: 10,
      filters: [{ field: "email", operator: "eq", value: email }],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GHL contact search failed (${res.status})`);
  const { contacts = [] } = (await res.json()) as { contacts?: { tags?: string[] }[] };
  const all = new Set(contacts.flatMap((c) => c.tags ?? []).map(norm));
  // A lead tagged both ways came in through an ad at some point: count it paid.
  if (all.has(tags.paid)) return "paid";
  if (all.has(tags.organic)) return "organic";
  return null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

async function getSplit(offer: CalendlyOffer, date: string) {
  const cfg = OFFERS[offer];
  const [{ calls }, notes, leads] = await Promise.all([
    calendlyFor(offer).then((c) => getCallsOnDate({ ...c, date })),
    airtableListFresh<Record<string, unknown>>(cfg.baseId, POST_CALL_NOTE_TABLE_ID, {
      filterByFormula: `OR(IS_AFTER({Date}, '${addDaysToDateString(date, -2)}'), IS_AFTER(CREATED_TIME(), '${addDaysToDateString(date, -2)}'))`,
      fields: ["Email (Lead)", "Call Taken", "Date", "Call Outcome"],
    }),
    cfg.getLeads(),
  ]);

  // Outcome per lead email from notes for calls taken that day (latest note wins).
  const outcomeByEmail = new Map<string, string>();
  const notedOnDate = new Set<string>();
  const sorted = [...notes].sort((a, b) => a.createdTime.localeCompare(b.createdTime));
  for (const { fields: f } of sorted) {
    const email = typeof f["Email (Lead)"] === "string" ? norm(f["Email (Lead)"]) : "";
    if (!email) continue;
    const taken = String(f["Call Taken"] ?? f.Date ?? "").slice(0, 10);
    if (taken === date) notedOnDate.add(email);
    outcomeByEmail.set(email, String(f["Call Outcome"] ?? ""));
  }
  const calendlyEmails = new Set(calls.map((c) => (c.inviteeEmail ? norm(c.inviteeEmail) : "")).filter(Boolean));
  const emails = [...new Set([...calendlyEmails, ...notedOnDate])];
  // Calls on the calendar with no email can't be matched to a source.
  const noEmail = calls.filter((c) => !c.inviteeEmail).length;

  const leadSource = new Map<string, Source>();
  for (const l of leads) {
    if (!l.email || !l.source) continue;
    if (/paid/i.test(l.source)) leadSource.set(norm(l.email), "paid");
    else if (/organic/i.test(l.source)) leadSource.set(norm(l.email), "organic");
  }

  const sources = await mapLimit(emails, 5, async (email) => {
    return (await ghlSource(offer, email)) ?? leadSource.get(email) ?? "unknown";
  });

  const split = { calls: emails.length + noEmail, booked: emptySplit(), showed: emptySplit(), closed: emptySplit() };
  split.booked.unknown += noEmail;
  emails.forEach((email, i) => {
    const source = sources[i];
    split.booked[source]++;
    const outcome = outcomeByEmail.get(email);
    if (outcome && !NOT_SHOWED.test(outcome)) split.showed[source]++;
    if (outcome && CLOSED.test(outcome)) split.closed[source]++;
  });
  return split;
}

export async function getDailyEodSummary(offer: CalendlyOffer, date: string): Promise<DailyEodSummary> {
  const cfg = OFFERS[offer];
  const [closerRows, setterRows] = await Promise.all([
    rowsOn(cfg.baseId, EOD_CLOSER_TABLE_ID, date),
    rowsOn(cfg.baseId, cfg.setterEodTableId, date),
  ]);
  const names = (rows: { fields: Record<string, unknown> }[], field: string) =>
    [...new Set(rows.map((r) => r.fields[field]).filter((v): v is string => typeof v === "string"))].sort();

  let split: DailyEodSummary["split"] = { calls: 0, booked: emptySplit(), showed: emptySplit(), closed: emptySplit() };
  let splitError: string | null = null;
  try {
    split = await getSplit(offer, date);
  } catch (err) {
    splitError = err instanceof Error ? err.message : String(err);
  }

  return {
    date,
    filed: {
      closers: names(closerRows, "Closer Name"),
      setters: names(setterRows, offer === "bronson" ? "Your name" : "Your Name"),
    },
    closer: sum(closerRows, CLOSER_FIELDS),
    setter: sum(setterRows, cfg.setter),
    split,
    splitError,
  };
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const eods = (n: number) => `${n} EOD${n === 1 ? "" : "s"}`;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");

function splitText(s: Split) {
  const parts = [`Paid ${s.paid}`, `Organic ${s.organic}`];
  if (s.unknown) parts.push(`No source ${s.unknown}`);
  return parts.join(" · ");
}

/** The Discord post. Kept under Discord's 2,000 character limit. */
export function dailyEodSummaryMessage(offerLabel: string, offer: CalendlyOffer, r: DailyEodSummary): string {
  const day = new Date(`${r.date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const c = r.closer;
  const s = r.setter;
  const lines = [`📊 **${offerLabel} EOD Totals for ${day}**`, ""];

  lines.push(`**Closers** (${eods(r.filed.closers.length)}${r.filed.closers.length ? `: ${r.filed.closers.join(", ")}` : ""})`);
  if (r.filed.closers.length) {
    lines.push(`📅 Calls booked: **${c.booked}**`);
    lines.push(`✅ Calls showed: **${c.showed}** (${pct(c.showed, c.booked)} show rate)`);
    lines.push(`Cancelled: ${c.cancelled} · Reschedules: ${c.reschedules} · DQ: ${c.dq}`);
    lines.push(`🤝 Offers made: ${c.offers} · Deals closed: **${c.closed}** (${pct(c.closed, c.showed)} of shows) · Deposits: ${c.deposits}`);
    lines.push(`💰 Cash collected: **${money(c.cash)}** · Revenue: ${money(c.revenue)}`);
    lines.push(`Deposits cash: ${money(c.depositsCash)} · Follow up payments: ${money(c.followUpPayments)}`);
    if (offer === "bronson") lines.push(`Bronson AI: ${c.aiSales} sales · ${money(c.aiCash)}`);
  }
  lines.push("");

  lines.push(`**Setters** (${eods(r.filed.setters.length)}${r.filed.setters.length ? `: ${r.filed.setters.join(", ")}` : ""})`);
  if (r.filed.setters.length) {
    lines.push(`📞 Dials: ${s.dials} · Pick ups: ${s.pickups} (${pct(s.pickups, s.dials)}) · Talk time: ${s.talkTime} min`);
    lines.push(`Software pitched: ${s.softwarePitched} · Software closed: **${s.softwareClosed}**`);
    lines.push(`High ticket calls pitched: ${s.htPitched} · Booked: **${s.htBooked}** · Sets closed: ${s.setClosed}`);
    lines.push(`Self-booked connected: ${s.selfBookedConnected} of ${s.selfBookedToReach} (${pct(s.selfBookedConnected, s.selfBookedToReach)})`);
    lines.push(`💰 Affiliate cash: **${money(s.affiliateCash)}** · High ticket cash: ${money(s.htCash)}`);
  }
  lines.push("");

  lines.push("**Paid vs Organic** (by lead's GHL tag)");
  if (r.splitError) {
    lines.push("⚠️ Couldn't build the split today (Calendly or GHL didn't load).");
  } else if (!r.split.calls) {
    lines.push("No sales calls on the calendar or in Post Call Notes.");
  } else {
    lines.push(`Calls booked: ${splitText(r.split.booked)}`);
    lines.push(`Calls showed: ${splitText(r.split.showed)}`);
    lines.push(`Deals closed: ${splitText(r.split.closed)}`);
    if (r.split.calls !== c.booked) {
      lines.push(`_Split covers the ${r.split.calls} calls found in Calendly + Post Call Notes, vs ${c.booked} booked on the EODs._`);
    }
  }

  const text = lines.join("\n");
  return text.length > 1990 ? `${text.slice(0, 1980)}\n…` : text;
}
