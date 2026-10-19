"use client";

import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { MetricGroups } from "@/components/dashboard/MetricGroups";
import { WebinarBreakdownTable } from "@/components/dashboard/WebinarBreakdownTable";
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

/**
 * Everything webinar in one section: booked calls, cash and ROAS on top, then
 * in funnel order ads, landing page and opt-ins, the live webinar (post-webinar card), VIP, then one column per
 * webinar. All from the Marketing Daily Metrics form.
 */
export function WebinarSection({
  webinar,
  goals,
  breakdownApiPath,
  title = "Webinar",
}: {
  webinar: WebinarTotals | undefined;
  goals?: GoalsConfig;
  breakdownApiPath: string;
  title?: string;
}) {
  const adsActive = (webinar?.adSpend ?? 0) > 0;
  const notActive = webinar && !adsActive ? "Not Active" : undefined;
  return (
    <DashboardSection title={title}>
      <div className="mb-4">
        <MetricGroups
          groups={[
            {
              title: "Booked Calls",
              metrics: [
                {
                  label: "Calls Booked",
                  value: webinar?.callsBooked,
                  format: "number",
                  subtext: "Live attendees at pitch × booking rate, per post-webinar card.",
                },
                {
                  label: "Cost Per Booked Call",
                  value: webinar?.costPerBookedCall,
                  format: "currency",
                  override: notActive,
                  subtext: "Ad spend ÷ calls booked off the webinars.",
                },
                {
                  label: "Cash Per Booked Call",
                  value: webinar?.cashPerBookedCall,
                  format: "currency",
                  subtext: "Webinar cash (high ticket + VIP) ÷ calls booked.",
                },
              ],
            },
            {
              title: "Cash & ROAS",
              metrics: [
                {
                  label: "ROAS (Paid)",
                  value: webinar?.roasPaid,
                  format: "ratio",
                  override: notActive,
                  subtext: "Paid high ticket + paid VIP cash ÷ ad spend.",
                  ...(adsActive ? kpi(webinar?.roasPaid, goals?.roasTotal, "ratio") : {}),
                },
                { label: "Webinar Cash", value: webinar?.webinarCash, format: "currency", subtext: "High ticket + VIP, paid + organic, from the form." },
                { label: "Webinar Cash (Paid)", value: webinar?.webinarCashPaid, format: "currency" },
                { label: "Webinar Cash (Organic)", value: webinar?.webinarCashOrganic, format: "currency" },
                { label: "High Ticket Cash", value: webinar?.highTicketCash, format: "currency", subtext: "Paid + organic." },
              ],
            },
          ]}
        />
      </div>
      <MetricGroups
        groups={[
          {
            title: "Ads",
            metrics: [
              { label: "Ad Spend", value: webinar?.adSpend, format: "currency", subtext: "Meta ad spend from the form." },
              { label: "CPM", value: webinar?.cpm, format: "currency", subtext: AVERAGED, ...kpi(webinar?.cpm, goals?.cpm, "currency") },
              { label: "Hook Rate", value: webinar?.hookRate, format: "percent", subtext: AVERAGED, ...kpi(webinar?.hookRate, goals?.hookRate, "percent") },
              { label: "Hold Rate", value: webinar?.holdRate, format: "percent", subtext: AVERAGED, ...kpi(webinar?.holdRate, goals?.holdRate, "percent") },
              { label: "Link Click-Through Rate", value: webinar?.linkClickThroughRate, format: "percent", subtext: AVERAGED, ...kpi(webinar?.linkClickThroughRate, goals?.linkClickThroughRate, "percent") },
              { label: "Cost Per Link Click", value: webinar?.costPerLinkClick, format: "currency", subtext: AVERAGED },
              { label: "Frequency", value: webinar?.adFrequency, format: "number", subtext: AVERAGED, ...kpi(webinar?.adFrequency, goals?.adFrequency, "number") },
            ],
          },
          {
            title: "Landing Page & Opt-Ins",
            metrics: [
              {
                label: "Cost Per Lead (Paid)",
                value: webinar?.costPerLeadPaid,
                format: "currency",
                override: notActive,
                subtext: "From the form; if blank, ad spend ÷ paid webinar opt-ins.",
                ...(adsActive ? kpi(webinar?.costPerLeadPaid, goals?.costPerLeadMeta, "currency") : {}),
              },
              { label: "Landing Page Connect Rate", value: webinar?.landingPageConnectRate, format: "percent", subtext: AVERAGED, ...kpi(webinar?.landingPageConnectRate, goals?.landingPageConnectRate, "percent") },
              { label: "Opt-In Rate", value: webinar?.optInRate, format: "percent", subtext: AVERAGED, ...kpi(webinar?.optInRate, goals?.webinarOptInRate, "percent") },
              { label: "Webinar Opt-Ins", value: webinar?.optIns, format: "number", subtext: "Paid + organic." },
              { label: "Webinar Opt-Ins (Paid)", value: webinar?.optInsPaid, format: "number" },
              { label: "Webinar Opt-Ins (Organic)", value: webinar?.optInsOrganic, format: "number" },
            ],
          },
          {
            title: "Live Webinar",
            metrics: [
              { label: "Webinars Held", value: webinar?.webinarsHeld, format: "number", subtext: "Post-webinar cards in this range." },
              { label: "Show Rate", value: webinar?.showRate, format: "percent", subtext: "From the post-webinar card, averaged across webinars." },
              { label: "Live Attendees", value: webinar?.liveAttendees, format: "number", subtext: "Summed across webinars." },
              { label: "Live Attendees at Pitch", value: webinar?.liveAttendeesAtPitch, format: "number", subtext: "Summed across webinars." },
              { label: "Retention Until Pitch", value: webinar?.retentionRateUntilPitch, format: "percent", subtext: "Averaged across webinars." },
              { label: "Booking Rate", value: webinar?.bookingRate, format: "percent", subtext: "Averaged across webinars." },
            ],
          },
          {
            title: "VIP",
            metrics: [
              {
                label: "Take Rate (Paid)",
                value: webinar?.takeRatePaid,
                format: "percent",
                subtext: "Paid VIP purchases ÷ paid webinar opt-ins.",
                ...kpi(webinar?.takeRatePaid, goals?.vipTakeRate, "percent"),
              },
              {
                label: "Take Rate (Organic)",
                value: webinar?.takeRateOrganic,
                format: "percent",
                subtext: "Organic VIP purchases ÷ organic webinar opt-ins.",
                ...kpi(webinar?.takeRateOrganic, goals?.vipTakeRate, "percent"),
              },
              { label: "VIP Purchases", value: webinar?.vipPurchases, format: "number", subtext: "Paid + organic." },
              { label: "VIP Purchases (Paid)", value: webinar?.vipPurchasesPaid, format: "number" },
              { label: "VIP Purchases (Organic)", value: webinar?.vipPurchasesOrganic, format: "number" },
              { label: "VIP Cash", value: webinar?.vipCash, format: "currency", subtext: "Paid + organic." },
              { label: "VIP Cash (Paid)", value: webinar?.vipCashPaid, format: "currency" },
              { label: "VIP Cash (Organic)", value: webinar?.vipCashOrganic, format: "currency" },
            ],
          },
        ]}
      />
      <p className="mt-3 text-sm text-[var(--text-muted)]">
        From the Marketing Daily Metrics form, for the date range above. VIP cash counts in Total Cash Collected and ROAS, paid and organic.
      </p>
      <WebinarBreakdownTable apiPath={breakdownApiPath} goals={goals} />
    </DashboardSection>
  );
}
