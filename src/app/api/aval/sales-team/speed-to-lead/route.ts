import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange, toEasternDateOnly } from "@/lib/date-range";
import { getAvalPostCallNotes, getAvalAffiliatePcn, getAvalSpeedToLead } from "@/lib/airtable/tables-aval";
import { avgSpeedToLead, leadsCalledSummary, medianSpeedToLead } from "@/lib/sales-team-metrics";

export const revalidate = 60;

/** lowercase, trimmed, trailing " affiliate" removed, spaces collapsed */
function normName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = raw
    .trim()
    .toLowerCase()
    .replace(/\s+affiliate$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  // ignore junk / too-generic names so we don't false-match
  if (n.length < 4 || n.includes("test")) return null;
  return n;
}

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const [rows, pcn, postCallNotes] = await Promise.all([
    getAvalSpeedToLead(),
    getAvalAffiliatePcn(),
    getAvalPostCallNotes(),
  ]);

  // The Speed to Lead table's "First Call At" is only populated for a subset
  // of contacts, so a blank one doesn't actually mean "never called". Any
  // lead that shows up in a call log (Affiliate PCN / Post Call Note) was
  // definitely spoken to — flag those so the UI can say "Called" instead of
  // lying with "Not called yet".
  const spokenTo = new Set<string>();
  for (const r of pcn) {
    const n = normName(r.leadName);
    if (n) spokenTo.add(n);
  }
  for (const r of postCallNotes) {
    const n = normName(r.leadName);
    if (n) spokenTo.add(n);
  }

  const inRange = rows
    .filter((r) => isDateInRange(toEasternDateOnly(r.createdAt), range))
    .map((r) => ({
      ...r,
      everSpokeTo: !r.firstCallAt && !!normName(r.name) && spokenTo.has(normName(r.name) as string),
    }))
    // newest opt-in first
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return Response.json({
    avgSpeedToLead: avgSpeedToLead(inRange),
    medianSpeedToLead: medianSpeedToLead(inRange),
    leadsCalled: leadsCalledSummary(inRange),
    leads: inRange,
  });
}
