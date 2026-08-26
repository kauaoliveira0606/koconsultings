import type { SpeedToLeadRow } from "./airtable/tables";
import { average, median } from "./metrics";

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
} {
  const called = rows.filter((r) => r.firstCallAt).length;
  return { called, total: rows.length, notYetCalled: rows.length - called };
}
