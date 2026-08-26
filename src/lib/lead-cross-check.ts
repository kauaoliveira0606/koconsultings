export type CrossCheckInput = {
  trackedPaid: number;
  trackedOrganic: number;
  typedPaid: number | null;
  typedOrganic: number | null;
};

export type CrossCheckResult = {
  mismatched: boolean;
  details: string[];
};

/**
 * Compares tracked lead counts (from the Leads table, grouped by Source)
 * against manually-typed opt-in numbers (from Marketing Daily Metrics) for
 * the same range, and flags when they disagree.
 */
export function crossCheckLeads(input: CrossCheckInput): CrossCheckResult {
  const details: string[] = [];

  const manualPaid = input.typedPaid ?? 0;
  const manualOrganic = input.typedOrganic ?? 0;

  if (input.trackedPaid !== manualPaid) {
    details.push(
      `Paid: ${input.trackedPaid} tracked vs ${manualPaid} manual (${
        input.trackedPaid - manualPaid
      })`
    );
  }
  if (input.trackedOrganic !== manualOrganic) {
    details.push(
      `Organic: ${input.trackedOrganic} tracked vs ${manualOrganic} manual (${
        input.trackedOrganic - manualOrganic
      })`
    );
  }

  return { mismatched: details.length > 0, details };
}
