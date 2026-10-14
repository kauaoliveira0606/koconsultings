import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { MetricGroups } from "@/components/dashboard/MetricGroups";
import type { WebinarTotals } from "@/lib/metrics";
import type { GoalsConfig, MaxGoal, MinGoal } from "@/lib/goals";
import { cellStatus } from "@/lib/weekly-scorecard";
import { formatStatValue, type StatFormat } from "@/lib/format";
import type { StatCardStatus } from "@/components/dashboard/StatCard";

const AVERAGED = "From the form, averaged across the days in range.";

/** Status + goal text for one KPI with a good line and (optionally) a bad line. */
function kpi(
  value: number | null | undefined,
  goal: MinGoal | MaxGoal | null | undefined,
  format: StatFormat,
): { status?: StatCardStatus; goal?: string } {
  if (!goal) return {};
  const fmt = (v: number) => formatStatValue(v, format);
  if ("min" in goal) {
    const bad = goal.redBelow !== undefined && goal.redBelow !== goal.min ? `, under ${fmt(goal.redBelow)} is bad` : "";
    return {
      status: value === undefined ? null : cellStatus(value, goal.min, "higher", goal.redBelow ?? null),
      goal: `≥ ${fmt(goal.min)}${bad}`,
    };
  }
  const bad = goal.redAbove !== undefined ? `, over ${fmt(goal.redAbove)} is bad` : "";
  return {
    status: value === undefined ? null : cellStatus(value, goal.max, "lower", goal.redAbove ?? null),
    goal: `≤ ${fmt(goal.max)}${bad}`,
  };
}

/** Webinar funnel, all from the Marketing Daily Metrics form. */
export function WebinarSection({
  webinar,
  goals,
}: {
  webinar: WebinarTotals | undefined;
  goals?: GoalsConfig;
}) {
  return (
    <DashboardSection title="Webinar Funnel">
      <MetricGroups
        groups={[
          {
            title: "VIP",
            metrics: [
              {
                label: "Take Rate (Paid)",
                value: webinar?.takeRatePaid,
                format: "percent",
                subtext: "Paid VIP purchases ÷ paid webinar opt-ins.",
              },
              {
                label: "Take Rate (Organic)",
                value: webinar?.takeRateOrganic,
                format: "percent",
                subtext: "Organic VIP purchases ÷ organic webinar opt-ins.",
              },
              { label: "VIP Purchases", value: webinar?.vipPurchases, format: "number", subtext: "Paid + organic." },
              { label: "VIP Purchases (Paid)", value: webinar?.vipPurchasesPaid, format: "number" },
              { label: "VIP Purchases (Organic)", value: webinar?.vipPurchasesOrganic, format: "number" },
              { label: "VIP Cash", value: webinar?.vipCash, format: "currency", subtext: "Paid + organic." },
              { label: "VIP Cash (Paid)", value: webinar?.vipCashPaid, format: "currency" },
              { label: "VIP Cash (Organic)", value: webinar?.vipCashOrganic, format: "currency" },
            ],
          },
          {
            title: "Opt-Ins",
            metrics: [
              { label: "Webinar Opt-Ins", value: webinar?.optIns, format: "number", subtext: "Paid + organic." },
              { label: "Webinar Opt-Ins (Paid)", value: webinar?.optInsPaid, format: "number" },
              { label: "Webinar Opt-Ins (Organic)", value: webinar?.optInsOrganic, format: "number" },
              { label: "Opt-In Rate", value: webinar?.optInRate, format: "percent", subtext: AVERAGED, ...kpi(webinar?.optInRate, goals?.webinarOptInRate, "percent") },
            ],
          },
          {
            title: "Ads",
            metrics: [
              { label: "Hook Rate", value: webinar?.hookRate, format: "percent", subtext: AVERAGED, ...kpi(webinar?.hookRate, goals?.hookRate, "percent") },
              { label: "Hold Rate", value: webinar?.holdRate, format: "percent", subtext: AVERAGED, ...kpi(webinar?.holdRate, goals?.holdRate, "percent") },
              { label: "Link Click-Through Rate", value: webinar?.linkClickThroughRate, format: "percent", subtext: AVERAGED, ...kpi(webinar?.linkClickThroughRate, goals?.linkClickThroughRate, "percent") },
              { label: "Cost Per Link Click", value: webinar?.costPerLinkClick, format: "currency", subtext: AVERAGED },
              { label: "CPM", value: webinar?.cpm, format: "currency", subtext: AVERAGED, ...kpi(webinar?.cpm, goals?.cpm, "currency") },
              { label: "Frequency", value: webinar?.adFrequency, format: "number", subtext: AVERAGED, ...kpi(webinar?.adFrequency, goals?.adFrequency, "number") },
            ],
          },
        ]}
      />
      <p className="mt-3 text-sm text-[var(--text-muted)]">
        From the Marketing Daily Metrics form. VIP cash counts in Total Cash Collected and ROAS, paid and organic.
      </p>
    </DashboardSection>
  );
}
