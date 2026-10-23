/**
 * The 9 AM accountability check, posted to each offer's sales chat:
 *
 * - Missing EODs: everyone ticked Active on the offer's "Team Roster" table
 *   must file an EOD for yesterday (closers the EOD Closer form, setters the
 *   Affiliate EOD form, "Closer + Setter" both). Weekends included.
 * - Missing Post Call Notes: every Calendly sales call that happened
 *   yesterday (no-shows included; canceled and rescheduled ones excluded)
 *   needs a Post Call Note with the same lead email, filed under the host.
 */
import { airtableListFresh } from "@/lib/airtable/client";
import { getCallsOnDate } from "@/lib/calendly";
import { calendlyFor, type CalendlyOffer } from "@/lib/calendly-offers";
import { addDaysToDateString } from "@/lib/date-range";
import { syncRoster } from "@/lib/roster-sync";

export const OFFERS: Record<
  CalendlyOffer,
  { baseId: string; rosterTableId: string; setterEodTableId: string; setterEodNameField: string }
> = {
  bronson: {
    baseId: "appiMw8gpaLv2WITA",
    rosterTableId: "tblODQjvFkVyphgYM",
    setterEodTableId: "tblezCVnizBHKPL4Q",
    setterEodNameField: "Your name",
  },
  aval: {
    baseId: "appgEcTIxQjmtRKbP",
    rosterTableId: "tbl8GjGQVd81Xz5Ic",
    setterEodTableId: "tblMsNIo5ZbNECcSv",
    setterEodNameField: "Your Name",
  },
};

// Same IDs in both bases (cloned from one template).
export const EOD_CLOSER_TABLE_ID = "tbl0xIvtCZIjemZRZ";
export const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";

export type MissingNote = { host: string; lead: string; email: string | null; start: string };

export type AccountabilityReport = {
  date: string;
  missingEod: { closers: string[]; setters: string[] };
  roster: { closers: number; setters: number };
  callsChecked: number;
  missingPcn: MissingNote[];
  /** Calendar events that day that weren't checked (canceled, rescheduled, not a sales call). */
  skippedEvents: { name: string; status: string; count: number }[];
  /** Set when Calendly couldn't be read; the EOD part still runs. */
  pcnError: string | null;
};

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Rows whose Date is exactly `date`, only the name field. */
async function namesFiledOn(baseId: string, tableId: string, nameField: string, date: string) {
  const rows = await airtableListFresh<Record<string, unknown>>(baseId, tableId, {
    filterByFormula: `DATETIME_FORMAT({Date}, 'YYYY-MM-DD') = '${date}'`,
    fields: [nameField],
  });
  return new Set(
    rows.map((r) => r.fields[nameField]).filter((v): v is string => typeof v === "string").map(norm)
  );
}

export async function getAccountabilityReport(offer: CalendlyOffer, date: string): Promise<AccountabilityReport> {
  const cfg = OFFERS[offer];
  // Anyone new since the last sync gets on the roster before it's checked.
  await syncRoster(offer).catch(() => null);
  const [roster, closerNames, setterNames] = await Promise.all([
    airtableListFresh<Record<string, unknown>>(cfg.baseId, cfg.rosterTableId),
    namesFiledOn(cfg.baseId, EOD_CLOSER_TABLE_ID, "Closer Name", date),
    namesFiledOn(cfg.baseId, cfg.setterEodTableId, cfg.setterEodNameField, date),
  ]);

  const missingEod = { closers: [] as string[], setters: [] as string[] };
  const counts = { closers: 0, setters: 0 };
  for (const { fields: f } of roster) {
    const name = typeof f.Name === "string" ? f.Name.trim() : "";
    if (!name || f.Active !== true) continue;
    const spellings = [name, ...String(f["Other Spellings"] ?? "").split(",")].map(norm).filter(Boolean);
    const role = String(f.Role ?? "");
    if (role.includes("Closer")) {
      counts.closers++;
      if (!spellings.some((s) => closerNames.has(s))) missingEod.closers.push(name);
    }
    if (role.includes("Setter")) {
      counts.setters++;
      if (!spellings.some((s) => setterNames.has(s))) missingEod.setters.push(name);
    }
  }

  let callsChecked = 0;
  let missingPcn: MissingNote[] = [];
  let skippedEvents: AccountabilityReport["skippedEvents"] = [];
  let pcnError: string | null = null;
  try {
    const [{ calls, skipped }, notes] = await Promise.all([
      calendlyFor(offer).then((c) => getCallsOnDate({ ...c, date })),
      // A note for this call can't be dated before the day before it.
      airtableListFresh<Record<string, unknown>>(cfg.baseId, POST_CALL_NOTE_TABLE_ID, {
        filterByFormula: `OR(IS_AFTER({Date}, '${addDaysToDateString(date, -2)}'), IS_AFTER(CREATED_TIME(), '${addDaysToDateString(date, -2)}'))`,
        fields: ["Email (Lead)"],
      }),
    ]);
    const noted = new Set(
      notes
        .map((n) => n.fields["Email (Lead)"])
        .filter((v): v is string => typeof v === "string")
        .map(norm)
    );
    callsChecked = calls.length;
    skippedEvents = skipped;
    missingPcn = calls
      .filter((c) => !c.inviteeEmail || !noted.has(norm(c.inviteeEmail)))
      .map((c) => ({
        host: c.host ?? "Unknown host",
        lead: c.inviteeName ?? c.inviteeEmail ?? "Unknown lead",
        email: c.inviteeEmail,
        start: c.start,
      }))
      .sort((a, b) => a.host.localeCompare(b.host) || a.start.localeCompare(b.start));
  } catch (err) {
    pcnError = err instanceof Error ? err.message : String(err);
  }

  return { date, missingEod, roster: counts, callsChecked, missingPcn, skippedEvents, pcnError };
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

const timeEt = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

/** The Discord post: names only, no tags. Kept under Discord's 2,000 character limit. */
export function accountabilityMessage(offerLabel: string, r: AccountabilityReport): string {
  const day = new Date(`${r.date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const lines = [`**${offerLabel} daily check for ${day}**`, ""];

  const { closers, setters } = r.missingEod;
  if (!closers.length && !setters.length) {
    lines.push("✅ Everyone filed their EOD.");
  } else {
    lines.push("❌ **Missed their EOD:**");
    if (closers.length) lines.push(`Closers: ${closers.join(", ")}`);
    if (setters.length) lines.push(`Setters: ${setters.join(", ")}`);
  }
  lines.push("");

  if (r.pcnError) {
    lines.push("⚠️ Couldn't check Post Call Notes today (Calendly didn't load).");
  } else if (!r.missingPcn.length) {
    lines.push(
      r.callsChecked
        ? `✅ All ${r.callsChecked} calls have a Post Call Note.`
        : "No sales calls on the calendar."
    );
  } else {
    lines.push(`❌ **Missing Post Call Notes (${r.missingPcn.length} of ${r.callsChecked} calls):**`);
    const byHost = new Map<string, MissingNote[]>();
    for (const n of r.missingPcn) byHost.set(n.host, [...(byHost.get(n.host) ?? []), n]);
    for (const [host, notes] of byHost) {
      lines.push(`${titleCase(host)}: ${notes.map((n) => `${n.lead} (${timeEt(n.start)})`).join(", ")}`);
    }
  }

  const text = lines.join("\n");
  return text.length > 1990 ? `${text.slice(0, 1980)}\n…` : text;
}
