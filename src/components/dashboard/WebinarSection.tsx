import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { MetricGroups } from "@/components/dashboard/MetricGroups";
import type { WebinarTotals } from "@/lib/metrics";

const AVERAGED = "From the form, averaged across the days in range.";

/** Webinar funnel, all from the Marketing Daily Metrics form. */
export function WebinarSection({ webinar }: { webinar: WebinarTotals | undefined }) {
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
              { label: "Opt-In Rate", value: webinar?.optInRate, format: "percent", subtext: AVERAGED },
            ],
          },
          {
            title: "Ads",
            metrics: [
              { label: "Hook Rate", value: webinar?.hookRate, format: "percent", subtext: AVERAGED },
              { label: "Hold Rate", value: webinar?.holdRate, format: "percent", subtext: AVERAGED },
              { label: "Link Click-Through Rate", value: webinar?.linkClickThroughRate, format: "percent", subtext: AVERAGED },
              { label: "Cost Per Link Click", value: webinar?.costPerLinkClick, format: "currency", subtext: AVERAGED },
              { label: "CPM", value: webinar?.cpm, format: "currency", subtext: AVERAGED },
              { label: "Frequency", value: webinar?.adFrequency, format: "number", subtext: AVERAGED },
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
