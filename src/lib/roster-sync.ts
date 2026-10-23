/**
 * Keeps each offer's "Team Roster" table up to date on its own: any name on a
 * recent EOD Closer, Affiliate EOD or Post Call Note that isn't on the roster
 * (by Name or Other Spellings) is added as Active, with the role it showed up
 * in. Someone already on the roster as a Closer who files an Affiliate EOD
 * (or the other way round) becomes "Closer + Setter". Inactive rows are never
 * touched: unticking Active is how someone is taken off.
 *
 * Only records created in the last 3 days are read, so people who stopped
 * filing long ago don't come back. Run every 10 minutes by n8n, and before
 * every 9 AM accountability check.
 */
import { AirtableError, airtableListFresh } from "@/lib/airtable/client";
import { EOD_CLOSER_TABLE_ID, OFFERS, POST_CALL_NOTE_TABLE_ID, norm } from "@/lib/accountability";
import type { CalendlyOffer } from "@/lib/calendly-offers";

type Role = "Closer" | "Setter";

const LOOKBACK_DAYS = 3;
// Post Call Note setter answers that aren't a person.
const NOT_A_PERSON = new Set(["no setter/unresposive", "no setter/unresponsive", "no setter", "none", "n/a"]);

export type RosterSyncResult = {
  added: { name: string; role: string }[];
  roleChanged: { name: string; from: string; to: string }[];
};

async function recentNames(baseId: string, tableId: string, field: string) {
  const rows = await airtableListFresh<Record<string, unknown>>(baseId, tableId, {
    filterByFormula: `IS_AFTER(CREATED_TIME(), DATEADD(NOW(), -${LOOKBACK_DAYS}, 'days'))`,
    fields: [field],
  });
  return rows
    .map((r) => r.fields[field])
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().replace(/\s+/g, " "))
    .filter((v) => v && !NOT_A_PERSON.has(norm(v)));
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

async function airtableWrite(baseId: string, tableId: string, method: "POST" | "PATCH", records: unknown[]) {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new AirtableError("Missing AIRTABLE_PAT environment variable", 500);
  for (let i = 0; i < records.length; i += 10) {
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
      method,
      headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: records.slice(i, i + 10), typecast: true }),
      cache: "no-store",
    });
    if (!res.ok) throw new AirtableError(`Airtable ${method} failed for ${tableId} (${res.status})`, res.status);
  }
}

export async function syncRoster(offer: CalendlyOffer): Promise<RosterSyncResult> {
  const cfg = OFFERS[offer];
  const [roster, eodClosers, eodSetters, pcnClosers, pcnSetters] = await Promise.all([
    airtableListFresh<Record<string, unknown>>(cfg.baseId, cfg.rosterTableId),
    recentNames(cfg.baseId, EOD_CLOSER_TABLE_ID, "Closer Name"),
    recentNames(cfg.baseId, cfg.setterEodTableId, cfg.setterEodNameField),
    recentNames(cfg.baseId, POST_CALL_NOTE_TABLE_ID, "First Name"),
    recentNames(cfg.baseId, POST_CALL_NOTE_TABLE_ID, "Setters Full Name"),
  ]);

  // Every spelling on the roster, active or not, points at its row.
  const bySpelling = new Map<string, { id: string; name: string; role: string; active: boolean }>();
  for (const { id, fields: f } of roster) {
    const name = typeof f.Name === "string" ? f.Name.trim() : "";
    if (!name) continue;
    const row = { id, name, role: String(f.Role ?? ""), active: f.Active === true };
    for (const s of [name, ...String(f["Other Spellings"] ?? "").split(",")].map(norm).filter(Boolean)) {
      if (!bySpelling.has(s)) bySpelling.set(s, row);
    }
  }

  // Name -> roles seen. Only an EOD changes the role of someone already on the roster.
  const seen = new Map<string, { name: string; roles: Set<Role>; fromEod: Set<Role> }>();
  const note = (names: string[], role: Role, fromEod: boolean) => {
    for (const name of names) {
      const key = norm(name);
      const entry = seen.get(key) ?? { name: titleCase(name), roles: new Set<Role>(), fromEod: new Set<Role>() };
      entry.roles.add(role);
      if (fromEod) entry.fromEod.add(role);
      seen.set(key, entry);
    }
  };
  note(eodClosers, "Closer", true);
  note(eodSetters, "Setter", true);
  note(pcnClosers, "Closer", false);
  note(pcnSetters, "Setter", false);

  const roleOf = (roles: Set<string>) =>
    roles.has("Closer") && roles.has("Setter") ? "Closer + Setter" : roles.has("Closer") ? "Closer" : "Setter";

  const result: RosterSyncResult = { added: [], roleChanged: [] };
  const creates: unknown[] = [];
  const updates = new Map<string, { name: string; from: string; to: string }>();
  for (const [key, entry] of seen) {
    const row = bySpelling.get(key);
    if (!row) {
      const role = roleOf(entry.roles);
      creates.push({ fields: { Name: entry.name, Role: role, Active: true } });
      result.added.push({ name: entry.name, role });
      continue;
    }
    if (!row.active || !entry.fromEod.size) continue;
    const current = updates.get(row.id)?.to ?? row.role;
    const roles = new Set<string>([...entry.fromEod]);
    if (current.includes("Closer")) roles.add("Closer");
    if (current.includes("Setter")) roles.add("Setter");
    const to = roleOf(roles);
    if (to !== current) updates.set(row.id, { name: row.name, from: row.role, to });
  }

  if (creates.length) await airtableWrite(cfg.baseId, cfg.rosterTableId, "POST", creates);
  if (updates.size) {
    await airtableWrite(
      cfg.baseId,
      cfg.rosterTableId,
      "PATCH",
      [...updates].map(([id, u]) => ({ id, fields: { Role: u.to } }))
    );
    result.roleChanged = [...updates.values()];
  }
  return result;
}
