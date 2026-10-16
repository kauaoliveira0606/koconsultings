/**
 * The 6 AM EOD totals post, sent to each offer's #eod-report: every EOD Closer
 * and Affiliate EOD filed for yesterday, summed.
 */
import { airtableListFresh } from "@/lib/airtable/client";
import type { CalendlyOffer } from "@/lib/calendly-offers";

const OFFERS: Record<
  CalendlyOffer,
  {
    baseId: string;
    setterEodTableId: string;
    setterNameField: string;
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
    setterNameField: "Your name",
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
    setterNameField: "Your Name",
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

// Same ID in both bases (cloned from one template).
const EOD_CLOSER_TABLE_ID = "tbl0xIvtCZIjemZRZ";

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

export type DailyEodSummary = {
  date: string;
  filed: { closers: string[]; setters: string[] };
  closer: Record<keyof typeof CLOSER_FIELDS, number>;
  setter: Record<keyof (typeof OFFERS)["bronson"]["setter"], number>;
};

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

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

export async function getDailyEodSummary(offer: CalendlyOffer, date: string): Promise<DailyEodSummary> {
  const cfg = OFFERS[offer];
  const [closerRows, setterRows] = await Promise.all([
    rowsOn(cfg.baseId, EOD_CLOSER_TABLE_ID, date),
    rowsOn(cfg.baseId, cfg.setterEodTableId, date),
  ]);
  const names = (rows: { fields: Record<string, unknown> }[], field: string) =>
    [...new Set(rows.map((r) => r.fields[field]).filter((v): v is string => typeof v === "string"))].sort();

  return {
    date,
    filed: { closers: names(closerRows, "Closer Name"), setters: names(setterRows, cfg.setterNameField) },
    closer: sum(closerRows, CLOSER_FIELDS),
    setter: sum(setterRows, cfg.setter),
  };
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const eods = (n: number) => `${n} EOD${n === 1 ? "" : "s"}`;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");

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

  const text = lines.join("\n");
  return text.length > 1990 ? `${text.slice(0, 1980)}\n…` : text;
}
