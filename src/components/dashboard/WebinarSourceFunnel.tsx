"use client";

import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { HeroStat } from "@/components/dashboard/HeroStat";
import { STATUS_TEXT_STYLE } from "@/components/dashboard/status";
import { formatStatValue, type StatFormat } from "@/lib/format";
import type { GoalsConfig, MinGoal } from "@/lib/goals";
import { useSectionData } from "@/lib/use-section-data";
import { cellStatus } from "@/lib/weekly-scorecard";
import type { SourceFunnel, WebinarSourceRow } from "@/lib/webinar-source-funnel";

type Payload = {
  range: Pick<WebinarSourceRow, "adSpend" | "paid" | "organic" | "total">;
  webinars: WebinarSourceRow[];
};

type Row = { label: string; format: StatFormat; value: (f: SourceFunnel) => number | null; goal?: MinGoal | null; paidOnly?: boolean };

function rows(goals: GoalsConfig | undefined): Row[] {
  return [
    { label: "Registered", format: "number", value: (f) => f.registered },
    { label: "Attended Live", format: "number", value: (f) => f.attended },
    { label: "Show Rate", format: "percent", value: (f) => f.showRate },
    { label: "Stayed Until Pitch", format: "number", value: (f) => f.stayed },
    { label: "Calls Booked", format: "number", value: (f) => f.booked },
    { label: "Booking Rate", format: "percent", value: (f) => f.bookingRate },
    { label: "Canceled", format: "number", value: (f) => f.canceled },
    { label: "Connection Rate", format: "percent", value: (f) => f.connectionRate, goal: goals?.connectionRate },
    { label: "Cost Per Booked Call", format: "currency", value: (f) => f.costPerBookedCall, paidOnly: true },
  ];
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Cell({ row, f }: { row: Row; f: SourceFunnel }) {
  const v = row.value(f);
  const status = row.goal ? cellStatus(v, row.goal.min, "higher", row.goal.redBelow ?? null) : null;
  return (
    <td className="px-3 py-2.5 text-right tabular-nums">
      {status ? (
        <span className="inline-block rounded-md px-2 py-0.5 font-bold" style={STATUS_TEXT_STYLE[status]}>
          {formatStatValue(v, row.format)}
        </span>
      ) : (
        <span className="font-semibold text-white">{formatStatValue(v, row.format)}</span>
      )}
    </td>
  );
}

function FunnelTable({
  columns,
  goals,
}: {
  columns: { key: string; head: React.ReactNode; f: SourceFunnel; paid: boolean; blank?: string }[];
  goals?: GoalsConfig;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-sm [&_tbody_tr]:border-b [&_tbody_tr]:border-white/[0.06]">
        <thead>
          <tr className="text-[13px] text-[var(--text-muted)]">
            <th className="sticky left-0 bg-[var(--panel-bg)] px-3 py-2.5 text-left font-semibold">Metric</th>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2.5 text-right align-bottom font-semibold">
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows(goals).map((r) => (
            <tr key={r.label}>
              <th className="sticky left-0 bg-[var(--panel-bg)] px-3 py-2.5 text-left align-middle font-medium text-[var(--text-strong)]">
                {r.label}
              </th>
              {columns.map((c) =>
                c.blank || (r.paidOnly && !c.paid) ? (
                  <td key={c.key} className="px-3 py-2.5 text-right text-[var(--text-muted)]">
                    {c.blank ?? "—"}
                  </td>
                ) : (
                  <Cell key={c.key} row={r} f={c.f} />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The webinar funnel split paid vs organic (Bronson + Aval), built automatically from
 * WebinarJam, Calendly and GHL call logs (see webinar-source-funnel.ts).
 */
export function WebinarSourceFunnel({
  apiPath,
  range,
  goals,
  period,
}: {
  /** e.g. /api/bronson/webinars/funnel */
  apiPath: string;
  range: Parameters<typeof useSectionData>[1];
  goals?: GoalsConfig;
  period?: string | null;
}) {
  const { data } = useSectionData<Payload>(apiPath, range);
  const t = data?.range;
  const hero = (label: string, value: number | null | undefined, sub: string, goal?: MinGoal | null) => (
    <HeroStat
      size="md"
      label={label}
      value={value}
      format="percent"
      period={period}
      sub={sub}
      {...(goal ? { status: value === undefined ? null : cellStatus(value ?? null, goal.min, "higher", goal.redBelow ?? null) } : {})}
    />
  );

  return (
    <DashboardSection title="Paid vs Organic Funnel">
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {hero("Show Rate (Paid)", t?.paid.showRate, t ? `${t.paid.attended} attended of ${t.paid.registered} registered` : "Attended ÷ registered")}
        {hero("Show Rate (Organic)", t?.organic.showRate, t ? `${t.organic.attended} attended of ${t.organic.registered} registered` : "Attended ÷ registered")}
        {hero("Booking Rate (Paid)", t?.paid.bookingRate, t ? `${t.paid.booked} booked of ${t.paid.stayed} at pitch` : "Booked ÷ stayed until pitch")}
        {hero("Booking Rate (Organic)", t?.organic.bookingRate, t ? `${t.organic.booked} booked of ${t.organic.stayed} at pitch` : "Booked ÷ stayed until pitch")}
        {hero("Connection Rate (Paid)", t?.paid.connectionRate, t ? `${t.paid.connected} of ${t.paid.connectable} booked leads` : "Booked leads reached", goals?.connectionRate)}
        {hero("Connection Rate (Organic)", t?.organic.connectionRate, t ? `${t.organic.connected} of ${t.organic.connectable} booked leads` : "Booked leads reached", goals?.connectionRate)}
      </div>

      <div className="mb-2 text-sm font-semibold text-[var(--text-strong)]">Webinars In Range</div>
      <div className="mb-4 min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm">
        {!t ? (
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        ) : (
          <FunnelTable
            goals={goals}
            columns={[
              { key: "paid", head: <span className="text-[var(--text-strong)]">Paid</span>, f: t.paid, paid: true },
              { key: "organic", head: <span className="text-[var(--text-strong)]">Organic</span>, f: t.organic, paid: false },
              { key: "total", head: <span className="text-[var(--text-strong)]">Total</span>, f: t.total, paid: false },
            ]}
          />
        )}
      </div>

      <div className="mb-2 text-sm font-semibold text-[var(--text-strong)]">Per Webinar</div>
      <div className="min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm">
        {!data ? (
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        ) : (
          <FunnelTable
            goals={goals}
            columns={data.webinars.flatMap((w) =>
              (["paid", "organic"] as const).map((k) => ({
                key: `${w.date}-${k}`,
                head: (
                  <>
                    <div className="text-[var(--text-strong)]">
                      #{w.number} · {shortDate(w.date)}
                    </div>
                    <div className="text-xs font-normal">{k === "paid" ? "Paid" : "Organic"}</div>
                  </>
                ),
                f: w[k],
                paid: k === "paid",
                blank: w.status === "upcoming" && w[k].registered === 0 ? "Not started" : undefined,
              })),
            )}
          />
        )}
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Automatic, no form input. Retention until pitch is not split here: it&apos;s the room at the pitch minute ÷ the room&apos;s peak, so it stays manual on the post-webinar card. Registered, attended and stayed until pitch (watched live 1 hour or more) come from WebinarJam; attendees count toward the session they watched. Source is the lead&apos;s masterclass paid / organic tag (ad campaign UTM = paid). A Calendly booking counts toward the latest webinar held on or before the day it was made; a reschedule counts once. Connection rate = booked leads with a 1+ min GHL call before their call; bookings the lead canceled themselves are left out. The post-webinar card above uses the form&apos;s own at-pitch count, so it can differ.
        </p>
      </div>
    </DashboardSection>
  );
}
