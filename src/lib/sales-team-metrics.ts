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
