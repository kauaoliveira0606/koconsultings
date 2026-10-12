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
                label: "Take Rate",
                value: webinar?.takeRate,
                format: "percent",
                subtext: "VIP purchases ÷ webinar opt-ins, paid and organic together.",
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
        From the Marketing Daily Metrics form. VIP cash is shown here only and is not added to Total Cash Collected.
      </p>
    </DashboardSection>
  );
}
