export type ScorecardMetric = {
  label: string;
  actual: number | null;
  goal: number | null;
  higherIsBetter: boolean;
};

/**
 * Deterministic, rule-based summary generator — NOT an LLM call. Mirrors
 * the reference dashboard's "rule-based, not AI-generated" behavior.
 */
export function generateWeeklySummary(metrics: ScorecardMetric[]): string {
  const missingGoal = metrics.filter((m) => m.goal === null);
  const missingActual = metrics.filter((m) => m.actual === null);
  const underperforming = metrics.filter((m) => {
    if (m.actual === null || m.goal === null) return false;
    return m.higherIsBetter ? m.actual < m.goal : m.actual > m.goal;
  });

  if (metrics.length === 0) {
    return "No metrics configured for this range yet.";
  }

  if (missingGoal.length === metrics.length) {
    return "Not enough data yet — every metric for this range is either missing a goal or has no actual value on the sheet. Once goals are set and daily numbers come in, this section will fill in with a health score and prioritized action items.";
  }

  if (missingActual.length === metrics.length) {
    return "No submissions logged for this range yet — once daily numbers start coming in, this section will fill in with a health score and prioritized action items.";
  }

  const parts: string[] = [];
  if (missingGoal.length > 0) {
    parts.push(
      `${missingGoal.length} metric${missingGoal.length === 1 ? "" : "s"} still need${
        missingGoal.length === 1 ? "s" : ""
      } a goal set (${missingGoal.map((m) => m.label).join(", ")}).`
    );
  }
  if (missingActual.length > 0) {
    parts.push(
      `${missingActual.length} metric${missingActual.length === 1 ? "" : "s"} have no data this range (${missingActual
        .map((m) => m.label)
        .join(", ")}).`
    );
  }
  if (underperforming.length > 0) {
    parts.push(
      `Underperforming vs. goal: ${underperforming.map((m) => m.label).join(", ")}.`
    );
  }
  if (parts.length === 0) {
    parts.push("Every measured metric is at or above goal for this range.");
  }

  return parts.join(" ");
}
