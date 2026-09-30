import type { SpeedToLeadRow } from "./airtable/tables";
import { average, median } from "./metrics";

/**
 * The same person can exist as two GHL contacts. Collapse rows sharing a
 * phone number into one lead: the earliest opt-in, and the earliest first
 * call at or after it. Rows without a phone stay as they are.
 */
export function dedupeByPhone(rows: SpeedToLeadRow[]): SpeedToLeadRow[] {
  const byPhone = new Map<string, SpeedToLeadRow[]>();
  const out: SpeedToLeadRow[] = [];
  for (const r of rows) {
    if (!r.phone) {
      out.push(r);
      continue;
    }
    const group = byPhone.get(r.phone) ?? [];
    group.push(r);
    byPhone.set(r.phone, group);
  }
  for (const group of byPhone.values()) {
    const lead = [...group].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))[0];
    const leadTime = lead.createdAt;
    const firstCall =
      group
        .map((r) => r.firstCallAt)
        .filter((t): t is string => !!t && (!leadTime || t >= leadTime))
        .sort()[0] ?? null;
    const minutesToCall =
      firstCall && leadTime
        ? Math.round(((Date.parse(firstCall) - Date.parse(leadTime)) / 60000) * 10) / 10
        : null;
    out.push({ ...lead, firstCallAt: firstCall, minutesToCall });
  }
  return out;
}

/** Called leads only: a lead nobody has called yet has no time to average. */
export function avgSpeedToLead(rows: SpeedToLeadRow[]): number | null {
  return average(rows.filter((r) => r.firstCallAt).map((r) => r.minutesToCall));
}

export function medianSpeedToLead(rows: SpeedToLeadRow[]): number | null {
  return median(rows.filter((r) => r.firstCallAt).map((r) => r.minutesToCall));
}

export function leadsCalledSummary(rows: SpeedToLeadRow[]): {
  called: number;
  total: number;
  notYetCalled: number;
  calledUnder5: number;
  under5Rate: number | null;
} {
  const called = rows.filter((r) => r.firstCallAt).length;
  const calledUnder5 = rows.filter(
    (r) => r.firstCallAt && r.minutesToCall !== null && r.minutesToCall < 5
  ).length;
  return {
    called,
    total: rows.length,
    notYetCalled: rows.length - called,
    calledUnder5,
    under5Rate: rows.length > 0 ? calledUnder5 / rows.length : null,
  };
}
