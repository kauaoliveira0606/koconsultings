"use client";

import { useState } from "react";
import useSWR from "swr";
import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { HeroStat } from "@/components/dashboard/HeroStat";
import { STATUS_TEXT_STYLE } from "@/components/dashboard/status";
import type { StatCardStatus } from "@/components/dashboard/StatCard";
import { formatStatValue, type StatFormat } from "@/lib/format";
import type { GoalsConfig, MaxGoal, MinGoal } from "@/lib/goals";
import { cellStatus } from "@/lib/weekly-scorecard";
import type { WebinarReport } from "@/lib/webinar-report";
import type { BookedCall, SourceFunnel } from "@/lib/webinar-source-funnel";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed (${res.status})`);
  return res.json();
};

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

type Goal = MinGoal | MaxGoal | null | undefined;

function statusOf(value: number | null | undefined, goal: Goal): StatCardStatus {
  if (!goal || value === undefined) return null;
  return "min" in goal
    ? cellStatus(value, goal.min, "higher", goal.redBelow ?? null)
    : cellStatus(value, goal.max, "lower", goal.redAbove ?? null);
}

/** A row: what each column shows; a column left out shows a dash. */
type Row = {
  label: string;
  format: StatFormat;
  paid?: (w: WebinarReport) => number | null;
  organic?: (w: WebinarReport) => number | null;
  total?: (w: WebinarReport) => number | null;
  goal?: Goal;
  note?: string;
};
type Group = { title: string; rows: Row[] };

/** The same metric off the automatic paid / organic funnel, all three columns. */
const split = (label: string, format: StatFormat, pick: (f: SourceFunnel) => number | null, extra?: Partial<Row>): Row => ({
  label,
  format,
  paid: (w) => pick(w.paid),
  organic: (w) => pick(w.organic),
  total: (w) => pick(w.total),
  ...extra,
});

function frontEnd(goals?: GoalsConfig): Group[] {
  return [
    {
      title: "Ads (Promo Days)",
      rows: [
        { label: "Ad Spend", format: "currency", paid: (w) => w.form.adSpend },
        { label: "CPM", format: "currency", paid: (w) => w.form.cpm, goal: goals?.cpm },
        { label: "Hook Rate", format: "percent", paid: (w) => w.form.hookRate, goal: goals?.hookRate },
        { label: "Hold Rate", format: "percent", paid: (w) => w.form.holdRate, goal: goals?.holdRate },
        { label: "Link Click-Through Rate", format: "percent", paid: (w) => w.form.linkClickThroughRate, goal: goals?.linkClickThroughRate },
        { label: "Cost Per Link Click", format: "currency", paid: (w) => w.form.costPerLinkClick },
        { label: "Frequency", format: "number", paid: (w) => w.form.adFrequency, goal: goals?.adFrequency },
      ],
    },
    {
      title: "Opt-Ins",
      rows: [
        { label: "Landing Page Connect Rate", format: "percent", total: (w) => w.form.landingPageConnectRate, goal: goals?.landingPageConnectRate },
        { label: "Opt-In Rate", format: "percent", total: (w) => w.form.optInRate, goal: goals?.webinarOptInRate },
        {
          label: "Webinar Opt-Ins",
          format: "number",
          paid: (w) => w.form.optInsPaid,
          organic: (w) => w.form.optInsOrganic,
          total: (w) => w.form.optIns,
        },
        { label: "Cost Per Lead", format: "currency", paid: (w) => w.form.costPerLeadPaid, goal: goals?.costPerLeadMeta },
      ],
    },
    {
      title: "Webinar",
      rows: [
        split("Registered", "number", (f) => f.registered),
        split("Attended Live", "number", (f) => f.attended),
        split("Webinar Show Rate", "percent", (f) => f.showRate),
        split("Stayed Until Pitch", "number", (f) => f.stayed, { note: "Watched live 1 hour or more." }),
        { label: "Live Attendees at Pitch", format: "number", total: (w) => w.form.liveAttendeesAtPitch, note: "Manual, post-webinar card." },
        { label: "Retention Until Pitch", format: "percent", total: (w) => w.form.retentionRateUntilPitch, note: "Manual: room at the pitch minute ÷ peak room." },
      ],
    },
    {
      title: "VIP",
      rows: [
        {
          label: "VIP Purchases",
          format: "number",
          paid: (w) => w.form.vipPurchasesPaid,
          organic: (w) => w.form.vipPurchasesOrganic,
          total: (w) => w.form.vipPurchases,
        },
        { label: "Take Rate", format: "percent", paid: (w) => w.form.takeRatePaid, organic: (w) => w.form.takeRateOrganic, goal: goals?.vipTakeRate },
        {
          label: "VIP Cash",
          format: "currency",
          paid: (w) => w.form.vipCashPaid,
          organic: (w) => w.form.vipCashOrganic,
          total: (w) => w.form.vipCash,
        },
      ],
    },
    {
      title: "Booking",
      rows: [
        split("Calls Booked", "number", (f) => f.booked),
        split("Booking Rate", "percent", (f) => f.bookingRate, { note: "Calls booked ÷ stayed until pitch." }),
        { label: "Cost Per Booked Call", format: "currency", paid: (w) => w.paid.costPerBookedCall, note: "Ad spend ÷ paid calls booked." },
      ],
    },
  ];
}

function backEnd(goals?: GoalsConfig): Group[] {
  return [
    {
      title: "Calls",
      rows: [
        split("Calls Booked", "number", (f) => f.booked),
        split("Canceled", "number", (f) => f.canceled),
        split("Connection Rate", "percent", (f) => f.connectionRate, {
          goal: goals?.connectionRate,
          note: "Booked leads with a 1+ min call before their call (self-cancels left out).",
        }),
        {
          label: "Call Connection Rate (EOD)",
          format: "percent",
          total: (w) => w.eodConnection.rate,
          goal: goals?.connectionRate,
          note: "Self-booked leads connected ÷ self-booked calls to reach out to, over this webinar's booking days.",
        },
        split("Showed", "number", (f) => f.showed),
        split("Calls Due So Far", "number", (f) => f.due, { note: "Call time has passed; self-cancels left out." }),
        split("Call Show Rate", "percent", (f) => f.callShowRate, { note: "Showed ÷ calls due so far." }),
        { label: "Cost Per Live Call", format: "currency", paid: (w) => w.paid.costPerLiveCall, note: "Ad spend ÷ paid calls that showed." },
        split("Closed", "number", (f) => f.closed),
        split("Close Rate", "percent", (f) => f.closeRate, { note: "Closed (PIF or payment plan) ÷ showed." }),
        split("Cash Collected", "currency", (f) => f.cashCollected),
      ],
    },
  ];
}

function Table({ groups, w }: { groups: Group[]; w: WebinarReport }) {
  const upcoming = w.status === "upcoming";
  const cell = (row: Row, pick: Row["paid"]) => {
    if (!pick) return <td className="px-3 py-2.5 text-right text-[var(--text-muted)]">—</td>;
    const v = pick(w);
    const status = statusOf(v, row.goal);
    return (
      <td className="px-3 py-2.5 text-right tabular-nums">
        {status && !upcoming ? (
          <span className="inline-block rounded-md px-2 py-0.5 font-bold" style={STATUS_TEXT_STYLE[status]}>
            {formatStatValue(v, row.format)}
          </span>
        ) : (
          <span className="font-semibold text-white">{formatStatValue(v, row.format)}</span>
        )}
      </td>
    );
  };
  return (
    <div className="min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm [&_tbody_tr]:border-b [&_tbody_tr]:border-white/[0.06]">
          <thead>
            <tr className="text-[13px] text-[var(--text-muted)]">
              <th className="sticky left-0 bg-[var(--panel-bg)] px-3 py-2.5 text-left font-semibold">Metric</th>
              {["Paid", "Organic", "Total"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-right font-semibold text-[var(--text-strong)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.title}>
              <tr>
                <th colSpan={4} className="px-3 pb-1.5 pt-4 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {g.title}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <th className="sticky left-0 bg-[var(--panel-bg)] px-3 py-2.5 text-left align-middle">
                    <span className="font-medium leading-tight text-[var(--text-strong)]">{r.label}</span>
                    {r.note ? <span className="block text-xs font-normal text-[var(--text-muted)]">{r.note}</span> : null}
                  </th>
                  {cell(r, r.paid)}
                  {cell(r, r.organic)}
                  {cell(r, r.total)}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

const SOURCE_STYLE: Record<string, string> = {
  Paid: "border-sky-400/40 bg-sky-400/15 text-sky-200",
  Organic: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
  Unknown: "border-white/15 bg-white/5 text-[var(--text-muted)]",
};

const callTimeLabel = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      }) + " ET"
    : "—";

/** Every booked call for the webinar, tagged paid / organic, filterable by source. */
function BookedCallsList({ calls }: { calls: BookedCall[] }) {
  const [filter, setFilter] = useState<"All" | "Paid" | "Organic" | "Unknown">("All");
  const count = (src: string) => calls.filter((c) => c.source === src).length;
  const shown = filter === "All" ? calls : calls.filter((c) => c.source === filter);
  const options = [
    { key: "All" as const, n: calls.length },
    { key: "Paid" as const, n: count("Paid") },
    { key: "Organic" as const, n: count("Organic") },
    ...(count("Unknown") ? [{ key: "Unknown" as const, n: count("Unknown") }] : []),
  ];
  return (
    <div className="min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setFilter(o.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
              filter === o.key
                ? "border-sky-400 bg-sky-400/15 text-white"
                : "border-[var(--panel-border)] text-[var(--text-muted)] hover:text-white"
            }`}
          >
            {o.key} · {o.n}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No calls booked{filter === "All" ? "" : ` from ${filter.toLowerCase()} leads`} for this webinar yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm [&_tbody_tr]:border-b [&_tbody_tr]:border-white/[0.06]">
            <thead>
              <tr className="text-[13px] text-[var(--text-muted)]">
                {["Lead", "Source", "Booked", "Call Time", "Status", "Connected", "Outcome", "Fathom", "Cash"].map((h, i) => (
                  <th key={h} className={`px-3 py-2.5 font-semibold ${i === 8 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-[var(--text-strong)]">{c.name ?? c.email ?? "—"}</span>
                    {c.name && c.email ? <span className="block text-xs text-[var(--text-muted)]">{c.email}</span> : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-bold ${SOURCE_STYLE[c.source]}`}>
                      {c.source}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-white">{shortDate(c.bookedDate)}</td>
                  <td className="px-3 py-2.5 text-white">{callTimeLabel(c.callTime)}</td>
                  <td className="px-3 py-2.5 text-white">{c.status === "Due" ? "Call Time Passed" : c.status}</td>
                  <td className="px-3 py-2.5 text-white">{c.connected ? "Yes" : "No"}</td>
                  <td className="px-3 py-2.5 text-white">{c.outcome ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    {c.fathomLinks?.length ? (
                      <span className="flex flex-wrap gap-x-3 gap-y-1">
                        {c.fathomLinks.map((href, i) => (
                          <a
                            key={href}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-sky-300 underline-offset-2 hover:underline"
                          >
                            {c.fathomLinks.length > 1 ? `Call ${i + 1}` : "Watch"}
                          </a>
                        ))}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white">
                    {c.cashCollected ? formatStatValue(c.cashCollected, "currency") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Webinars tab (Bronson + Aval), one webinar at a time (user, 2026-10-19):
 * Front End runs from the ads to the booked call, ending on cost per booked
 * call; Back End is everything after the call is on the calendar.
 */
export function WebinarsTab({ offer }: { offer: "bronson" | "aval" }) {
  const { data, error } = useSWR<{ webinars: WebinarReport[] }>(`/api/${offer}/webinars/report`, fetcher);
  const { data: goals } = useSWR<GoalsConfig>(`/api/${offer}/goals`, fetcher);
  const webinars = data?.webinars ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const w = webinars.find((x) => x.date === picked) ?? webinars.find((x) => x.status === "done") ?? webinars[0];
  const pill = w ? `Webinar #${w.number} · ${shortDate(w.date)}` : null;
  const hero = (label: string, value: number | null | undefined, format: StatFormat, sub: string, goal?: Goal) => (
    <HeroStat size="md" label={label} value={value} format={format} period={pill} sub={sub} status={statusOf(value, goal)} />
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Webinars</h1>
        <div className="flex flex-wrap gap-2">
          {webinars.map((x) => (
            <button
              key={x.date}
              type="button"
              onClick={() => setPicked(x.date)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                x.date === w?.date
                  ? "border-sky-400 bg-sky-400/15 text-white"
                  : "border-[var(--panel-border)] text-[var(--text-muted)] hover:text-white"
              }`}
            >
              #{x.number} · {shortDate(x.date)}
              {x.status === "upcoming" ? " (upcoming)" : ""}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-[var(--text-muted)]">Couldn&apos;t load the webinars.</p>
      ) : !w ? (
        <p className="text-sm text-[var(--text-muted)]">Loading...</p>
      ) : (
        <>
          <p className="mb-6 text-sm text-[var(--text-muted)]">
            Promo {shortDate(w.promoStart)} to {shortDate(w.date)}.{" "}
            {w.bookingWindow
              ? `Calls booked ${shortDate(w.bookingWindow.from)} to ${shortDate(w.bookingWindow.to)} count toward this webinar.`
              : "Not held yet."}
          </p>

          <DashboardSection title="Front End">
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {hero("Cost Per Lead (Paid)", w.form.costPerLeadPaid, "currency", "Ad spend ÷ paid opt-ins", goals?.costPerLeadMeta)}
              {hero("Booking Rate (Paid)", w.paid.bookingRate, "percent", `${w.paid.booked} booked of ${w.paid.stayed} at pitch`)}
              {hero("Booking Rate (Organic)", w.organic.bookingRate, "percent", `${w.organic.booked} booked of ${w.organic.stayed} at pitch`)}
              {hero("Webinar Show Rate (Paid)", w.paid.showRate, "percent", `${w.paid.attended} of ${w.paid.registered} registered`)}
              {hero("Webinar Show Rate (Organic)", w.organic.showRate, "percent", `${w.organic.attended} of ${w.organic.registered} registered`)}
              {hero("Cost Per Booked Call (Paid)", w.paid.costPerBookedCall, "currency", "Ad spend ÷ paid calls booked")}
            </div>
            <Table groups={frontEnd(goals)} w={w} />
          </DashboardSection>

          <DashboardSection title="Back End">
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {hero("Call Show Rate (Paid)", w.paid.callShowRate, "percent", `${w.paid.showed} of ${w.paid.due} calls due so far`)}
              {hero("Call Show Rate (Organic)", w.organic.callShowRate, "percent", `${w.organic.showed} of ${w.organic.due} calls due so far`)}
              {hero("Cost Per Live Call (Paid)", w.paid.costPerLiveCall, "currency", "Ad spend ÷ paid calls that showed")}
              {hero("Close Rate (Paid)", w.paid.closeRate, "percent", `${w.paid.closed} of ${w.paid.showed} showed`)}
              {hero("Close Rate (Organic)", w.organic.closeRate, "percent", `${w.organic.closed} of ${w.organic.showed} showed`)}
              {hero("Cash Collected", w.total.cashCollected, "currency", "From the booked leads' post call notes")}
            </div>
            <Table groups={backEnd(goals)} w={w} />
          </DashboardSection>

          <DashboardSection title="Booked Calls: Paid vs Organic">
            <BookedCallsList key={w.date} calls={w.calls ?? []} />
          </DashboardSection>

          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Ads, opt-ins, VIP, live attendees at pitch and retention come from the daily form and post-webinar card. Registered, attended and stayed until pitch come from WebinarJam; bookings and cancels from Calendly; connected calls from GHL; showed, closed and cash from each booked lead&apos;s post call notes (matched by email). Paid = the lead signed up from an ad (campaign UTM). Every cost is ad spend over the paid count only.
          </p>
        </>
      )}
    </div>
  );
}
