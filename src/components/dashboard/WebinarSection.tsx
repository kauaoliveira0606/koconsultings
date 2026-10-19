"use client";

import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { MetricGroups } from "@/components/dashboard/MetricGroups";
import { HeroStat } from "@/components/dashboard/HeroStat";
import { WebinarBreakdownTable } from "@/components/dashboard/WebinarBreakdownTable";
import type { WebinarTotals } from "@/lib/metrics";
import type { GoalsConfig, MaxGoal, MinGoal } from "@/lib/goals";
import { cellStatus } from "@/lib/weekly-scorecard";
import { formatStatValue, type StatFormat } from "@/lib/format";
import type { StatCardStatus } from "@/components/dashboard/StatCard";

const AVERAGED = "From the form, averaged across the days in range.";

/** Bronson only: self-booked leads connected ÷ self-booked calls to reach out to (Affiliate EOD). */
export type WebinarConnection = { reachOut: number; connected: number; rate: number | null };

type SourceBookings = {
  booked: number;
  canceled: number;
  connected: number;
  connectable: number;
  optIns: number;
  bookingRate: number | null;
  connectionRate: number | null;
};
/** Bronson only: Calendly bookings split by the lead's masterclass paid / organic tag. */
export type WebinarBookings = { trackingStart: string; paid: SourceBookings; organic: SourceBookings };

const shortDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

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
 * Everything webinar in one section: hero cards for the numbers checked first,
 * then in funnel order ads, landing page and opt-ins, the live webinar (post-webinar card), VIP, then one column per
 * webinar. All from the Marketing Daily Metrics form.
 */
export function WebinarSection({
  webinar,
  goals,
  breakdownApiPath,
  title = "Webinar",
  period,
}: {
  webinar: (WebinarTotals & { startDate?: string | null; connection?: WebinarConnection; bookings?: WebinarBookings }) | undefined;
  goals?: GoalsConfig;
  breakdownApiPath: string;
  title?: string;
  /** Shown in the hero cards' pill, e.g. 10/14 → 10/19. */
  period?: string | null;
}) {
  const adsActive = (webinar?.adSpend ?? 0) > 0;
  const notActive = webinar && !adsActive ? "Not Active" : undefined;
  const conn = webinar?.connection;
  const bk = webinar?.bookings;
  const since = bk ? `, since ${shortDate(bk.trackingStart)}` : "";
  return (
    <DashboardSection title={title}>
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HeroStat
          label="Cost Per Booked Call"
          value={webinar?.costPerBookedCall}
          format="currency"
          period={period}
          override={notActive}
          sub="Ad spend ÷ calls booked"
        />
        <HeroStat
          label="Calls Booked"
          value={webinar?.callsBooked}
          format="number"
          period={period}
          sub="At pitch × booking rate"
        />
        <HeroStat
          label="Cost Per Lead"
          value={webinar?.costPerLeadPaid}
          format="currency"
          period={period}
          override={notActive}
          {...(adsActive ? kpi(webinar?.costPerLeadPaid, goals?.costPerLeadMeta, "currency") : {})}
          sub="Paid"
        />
        <HeroStat
          label="ROAS (Paid)"
          value={webinar?.roasPaid}
          format="ratio"
          period={period}
          override={notActive}
          {...(adsActive ? kpi(webinar?.roasPaid, goals?.roasTotal, "ratio") : {})}
          sub="Paid VIP cash ÷ ad spend"
        />
        <HeroStat
          size="md"
          label="Take Rate (Paid)"
          value={webinar?.takeRatePaid}
          format="percent"
          {...kpi(webinar?.takeRatePaid, goals?.vipTakeRate, "percent")}
          sub={`${formatStatValue(webinar?.vipPurchasesPaid, "number")} of ${formatStatValue(webinar?.optInsPaid, "number")} opt-ins`}
        />
        <HeroStat
          size="md"
          label="Take Rate (Organic)"
          value={webinar?.takeRateOrganic}
          format="percent"
          {...kpi(webinar?.takeRateOrganic, goals?.vipTakeRate, "percent")}
          sub={`${formatStatValue(webinar?.vipPurchasesOrganic, "number")} of ${formatStatValue(webinar?.optInsOrganic, "number")} opt-ins`}
        />
        <HeroStat
          size="md"
          label="VIP Cash"
          value={webinar?.vipCash}
          format="currency"
          sub={`${formatStatValue(webinar?.vipCashPaid, "currency")} paid · ${formatStatValue(webinar?.vipCashOrganic, "currency")} organic`}
        />
        <HeroStat
          size="md"
          label="Ad Spend"
          value={webinar?.adSpend}
          format="currency"
          sub="Meta, since the webinar launched"
        />
      </div>
      <p className="mb-6 text-xs text-slate-400">
        Webinar cash is VIP only for now: no sales form tags a high ticket sale as coming from the webinar yet.
      </p>
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
          ...(conn
            ? [
                {
                  title: "Calls",
                  metrics: [
                    {
                      label: "Call Connection Rate (EOD)",
                      value: conn.rate,
                      format: "percent" as const,
                      subtext: `${formatStatValue(conn.connected, "number")} self-booked leads connected ÷ ${formatStatValue(conn.reachOut, "number")} self-booked calls to reach out to, from the Affiliate EOD.`,
                      ...kpi(conn.rate, goals?.connectionRate, "percent"),
                    },
                    ...(bk
                      ? (["paid", "organic"] as const).flatMap((k) => {
                          const b = bk[k];
                          const name = k === "paid" ? "Paid" : "Organic";
                          return [
                            {
                              label: `Calls Booked (${name})`,
                              value: b.booked,
                              format: "number" as const,
                              subtext: `Calendly bookings by leads tagged masterclass ${k}${b.canceled ? `, ${b.canceled} canceled` : ""}${since}.`,
                            },
                            {
                              label: `Booking Rate (${name})`,
                              value: b.bookingRate,
                              format: "percent" as const,
                              subtext: `${b.booked} bookings ÷ ${b.optIns} ${k} webinar opt-ins${since}.`,
                            },
                            {
                              label: `Connection Rate (${name})`,
                              value: b.connectionRate,
                              format: "percent" as const,
                              subtext: `${b.connected} of ${b.connectable} booked leads (not canceled) had a 1+ min call before their call. Automatic from GHL call logs.`,
                              ...kpi(b.connectionRate, goals?.connectionRate, "percent"),
                            },
                          ];
                        })
                      : []),
                  ],
                },
              ]
            : []),
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
              { label: "VIP Cash (Paid)", value: webinar?.vipCashPaid, format: "currency" },
              { label: "VIP Cash (Organic)", value: webinar?.vipCashOrganic, format: "currency" },
            ],
          },
        ]}
      />
      <p className="mt-3 text-sm text-[var(--text-muted)]">
        From the Marketing Daily Metrics form, for the date range above, counting only days since the webinar funnel started{webinar?.startDate ? ` (${new Date(`${webinar.startDate}T00:00:00Z`).toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })})` : ""}.
      </p>
      <WebinarBreakdownTable apiPath={breakdownApiPath} goals={goals} />
    </DashboardSection>
  );
}
