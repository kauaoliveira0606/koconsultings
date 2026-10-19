"use client";

import useSWR from "swr";
import { STATUS_TEXT_STYLE } from "@/components/dashboard/status";
import { formatStatValue, type StatFormat } from "@/lib/format";
import type { GoalsConfig, MinGoal } from "@/lib/goals";
import type { WebinarBreakdownRow } from "@/lib/webinar-breakdown";
import { cellStatus } from "@/lib/weekly-scorecard";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed (${res.status})`);
  return res.json();
};

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

type Metric = {
  label: string;
  format: StatFormat;
  value: (w: WebinarBreakdownRow) => number | null;
  goal?: MinGoal | null;
  /** From the post-webinar card, so blank on the webinar still in progress. */
  card?: boolean;
};

type Group = { title: string; metrics: Metric[] };

function groups(goals: GoalsConfig | undefined): Group[] {
  return [
    {
      title: "Daily Form (Days Leading Up)",
      metrics: [
        { label: "Webinar Opt-Ins", format: "number", value: (w) => w.optIns },
        { label: "Opt-Ins (Paid)", format: "number", value: (w) => w.optInsPaid },
        { label: "Opt-Ins (Organic)", format: "number", value: (w) => w.optInsOrganic },
        { label: "VIP Purchases", format: "number", value: (w) => w.vipPurchases },
        { label: "Take Rate (Paid)", format: "percent", value: (w) => w.takeRatePaid, goal: goals?.vipTakeRate },
        { label: "Take Rate (Organic)", format: "percent", value: (w) => w.takeRateOrganic, goal: goals?.vipTakeRate },
        { label: "VIP Cash", format: "currency", value: (w) => w.vipCash },
        { label: "Ad Spend", format: "currency", value: (w) => w.adSpend },
        { label: "Cost Per Lead (Paid)", format: "currency", value: (w) => w.costPerLeadPaid },
      ],
    },
    {
      title: "Calls & ROAS",
      metrics: [
        { label: "Calls Booked", format: "number", value: (w) => w.callsBooked, card: true },
        { label: "Cost Per Booked Call (Paid)", format: "currency", value: (w) => w.costPerBookedCall, card: true },
        { label: "ROAS (Paid)", format: "ratio", value: (w) => w.roasPaid, goal: goals?.roasTotal },
      ],
    },
    {
      title: "Post-Webinar Card",
      metrics: [
        { label: "Show Rate", format: "percent", value: (w) => w.showRate, card: true },
        { label: "Live Attendees", format: "number", value: (w) => w.liveAttendees, card: true },
        { label: "Live Attendees at Pitch", format: "number", value: (w) => w.liveAttendeesAtPitch, card: true },
        { label: "Retention Until Pitch", format: "percent", value: (w) => w.retentionRateUntilPitch, card: true },
        { label: "Booking Rate", format: "percent", value: (w) => w.bookingRate, card: true },
      ],
    },
  ];
}

function goalText(goal: MinGoal | null | undefined, format: StatFormat): string | null {
  if (!goal) return null;
  const bad = goal.redBelow !== undefined && goal.redBelow !== goal.min ? `, under ${formatStatValue(goal.redBelow, format)} is bad` : "";
  return `≥ ${formatStatValue(goal.min, format)}${bad}`;
}

/**
 * One column per webinar run (see webinar-schedule.ts), newest first, planned
 * ones included. Not tied to the range picker: each column is one webinar.
 */
export function WebinarBreakdownTable({ apiPath, goals }: { apiPath: string; goals?: GoalsConfig }) {
  const { data } = useSWR<{ webinars: WebinarBreakdownRow[] }>(apiPath, fetcher);
  const webinars = data?.webinars;

  return (
    <div className="mt-4">
      <div className="mb-2 text-sm font-semibold text-[var(--text-strong)]">Per Webinar</div>
      <div className="min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm">
        {!webinars ? (
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        ) : webinars.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No webinar data on the form yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm [&_tbody_tr]:border-b [&_tbody_tr]:border-white/[0.06]">
              <thead>
                <tr className="text-[13px] text-[var(--text-muted)]">
                  <th className="sticky left-0 bg-[var(--panel-bg)] px-3 py-2.5 text-left font-semibold">Metric</th>
                  {webinars.map((w) => (
                    <th key={w.start} className="px-3 py-2.5 text-right align-bottom font-semibold">
                      <div className="text-[var(--text-strong)]">
                        Webinar #{w.number} · {shortDate(w.date)}
                      </div>
                      <div className="text-xs font-normal">
                        {w.status === "upcoming"
                          ? `Upcoming · promo starts ${shortDate(w.start)}`
                          : w.status === "promo"
                            ? `In promo · since ${shortDate(w.start)}`
                            : `Promo ${shortDate(w.start)} to ${shortDate(w.date)}`}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              {groups(goals).map((g) => (
                <tbody key={g.title}>
                  <tr>
                    <th
                      colSpan={webinars.length + 1}
                      className="px-3 pb-1.5 pt-4 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                    >
                      {g.title}
                    </th>
                  </tr>
                  {g.metrics.map((m) => {
                    const goal = goalText(m.goal, m.format);
                    return (
                      <tr key={m.label}>
                        <th className="sticky left-0 bg-[var(--panel-bg)] px-3 py-2.5 text-left align-middle">
                          <span className="font-medium leading-tight text-[var(--text-strong)]">{m.label}</span>
                          {goal ? <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">{goal}</span> : null}
                        </th>
                        {webinars.map((w) => {
                          if (w.status === "upcoming" || (m.card && !w.hasCard)) {
                            return (
                              <td key={w.start} className="px-3 py-2.5 text-right text-[var(--text-muted)]">
                                {w.status === "upcoming" ? "Not started" : "No card yet"}
                              </td>
                            );
                          }
                          const v = m.value(w);
                          const status = m.goal ? cellStatus(v, m.goal.min, "higher", m.goal.redBelow ?? null) : null;
                          return (
                            <td key={w.start} className="px-3 py-2.5 text-right tabular-nums">
                              {status ? (
                                <span className="inline-block rounded-md px-2 py-0.5 font-bold" style={STATUS_TEXT_STYLE[status]}>
                                  {formatStatValue(v, m.format)}
                                </span>
                              ) : (
                                <span className="font-semibold text-white">{formatStatValue(v, m.format)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          One column per webinar run. Its daily numbers are the form days of its promo period through the webinar day; the card numbers come from the post-webinar card submitted that day. Break days between webinars count toward none. Not tied to the date range above.
        </p>
      </div>
    </div>
  );
}
