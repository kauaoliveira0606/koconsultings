"use client";

import { useState } from "react";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { BerlinHeader, Panel } from "@/components/berlin/Berlin";
import { KpiValue, toneFor, type KpiKey } from "@/components/berlin/kpi";
import { formatStatValue } from "@/lib/format";

type Step = { key: string; label: string; value: number | null; rate: number | null; rateLabel: string | null; kpi: KpiKey | null; note: string };
type Data = {
  source: "paid" | "organic" | "total";
  steps: Step[];
  money: {
    spend: number | null;
    cash: number | null;
    roas: number | null;
    cpm: number | null;
    costPerOptIn: number | null;
    costPerAttendee: number | null;
    costPerBooked: number | null;
    costPerClose: number | null;
  };
  webinars: { number: number; date: string; status: string; registered: number; attended: number; booked: number; closed: number; cash: number }[];
  notes: { registrantsVsAds: string | null };
};

const SOURCES = [
  { id: "paid", label: "Paid" },
  { id: "organic", label: "Organic" },
  { id: "total", label: "All" },
] as const;

/** Funnel analytics: the webinar funnel as a map with conversion on every arrow, then where people drop. */
export function FunnelAnalytics() {
  const { range, setRange } = useSharedRange();
  const [source, setSource] = useState<Data["source"]>("paid");
  const { data, isLoading } = useSectionData<Data>(`/api/bronson/funnels/analytics?source=${source}`, range, 300_000);

  const steps = data?.steps ?? [];
  const top = steps.find((s) => s.value)?.value ?? 0;
  const biggestDrop = steps
    .slice(1)
    .map((s, i) => ({ s, prev: steps[i] }))
    .filter((x) => x.s.rate !== null && x.prev.value)
    .sort((a, b) => (a.s.rate ?? 1) - (b.s.rate ?? 1))[0];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <BerlinHeader title="Funnel" subtitle="Webinar funnel, step by step: what each step converts to the next, and where people drop." />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-0.5">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-semibold ${source === s.id ? "bg-black text-white" : "text-[var(--text-muted)]"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <RangeFilterBar value={range} onChange={setRange} />
        </div>
      </div>

      {/* Map */}
      <Panel className="mb-6 overflow-x-auto">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[15px] font-semibold text-[var(--text-strong)]">Map</div>
          {isLoading && !data ? <span className="text-[12px] text-[var(--text-muted)]">Loading…</span> : null}
        </div>
        <div className="flex min-w-max items-stretch gap-0 pb-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-stretch">
              {i > 0 ? (
                <div className="flex w-24 flex-col items-center justify-center px-1 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{s.rateLabel}</div>
                  <KpiValue value={s.rate} format="percent" tone={s.kpi ? toneFor(s.kpi, s.rate) : null} />
                  <svg width="72" height="10" viewBox="0 0 72 10" className="mt-1" aria-hidden="true">
                    <path d="M0 5 H66 M60 1 L67 5 L60 9" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" />
                  </svg>
                </div>
              ) : null}
              <div className="w-40 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-subtle)] p-3">
                <div className="text-[12px] font-semibold text-[var(--text-muted)]">{s.label}</div>
                <div className="mt-1 text-[1.5rem] font-bold leading-tight text-[var(--text-strong)]">{formatStatValue(s.value, "number")}</div>
                <div className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">{s.note}</div>
              </div>
            </div>
          ))}
          {data ? (
            <div className="flex items-stretch">
              <div className="flex w-16 items-center justify-center">
                <svg width="48" height="10" viewBox="0 0 48 10" aria-hidden="true">
                  <path d="M0 5 H42 M36 1 L43 5 L36 9" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="w-40 rounded-xl border-2 border-emerald-600/40 bg-[var(--cell-green-bg)] p-3">
                <div className="text-[12px] font-semibold text-[var(--cell-green-text)]">Cash collected</div>
                <div className="mt-1 text-[1.5rem] font-bold leading-tight text-[var(--cell-green-text)]">{formatStatValue(data.money.cash, "currency")}</div>
                {data.money.roas !== null ? (
                  <div className="mt-1"><KpiValue value={data.money.roas} format="ratio" tone={toneFor("roas", data.money.roas)} /> ROAS</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        {data?.notes.registrantsVsAds ? <p className="mt-3 text-[11px] text-[var(--text-muted)]">{data.notes.registrantsVsAds}</p> : null}
      </Panel>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Drop-off */}
        <Panel>
          <div className="mb-3 text-[15px] font-semibold text-[var(--text-strong)]">Where people drop</div>
          <div className="space-y-2.5">
            {steps.map((s, i) => {
              const pct = top && s.value ? (s.value / top) * 100 : 0;
              const lost = i > 0 && steps[i - 1].value && s.value !== null ? (steps[i - 1].value as number) - s.value : null;
              return (
                <div key={s.key}>
                  <div className="mb-1 flex items-baseline justify-between text-[13px]">
                    <span className="font-medium text-[var(--text-strong)]">{s.label}</span>
                    <span className="tabular-nums text-[var(--text-muted)]">
                      {formatStatValue(s.value, "number")}
                      {lost !== null && lost > 0 ? <span className="ml-2 text-rose-600">−{formatStatValue(lost, "number")}</span> : null}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[var(--panel-subtle)]">
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(pct, s.value ? 0.6 : 0)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {biggestDrop ? (
            <p className="mt-4 rounded-lg bg-[var(--cell-yellow-bg)] px-3 py-2 text-[13px] text-[var(--cell-yellow-text)]">
              Biggest drop: {biggestDrop.prev.label} → {biggestDrop.s.label}, only {formatStatValue(biggestDrop.s.rate, "percent")} make it through.
            </p>
          ) : null}
        </Panel>

        {/* Cost per step */}
        <Panel>
          <div className="mb-3 text-[15px] font-semibold text-[var(--text-strong)]">Cost per step</div>
          {data && data.money.spend !== null ? (
            <dl className="divide-y divide-[var(--panel-border)] text-[14px]">
              <Row label="Ad spend (Cortana)" value={<KpiValue value={data.money.spend} format="currency" bold />} />
              <Row label="CPM" value={<KpiValue value={data.money.cpm} format="currency" tone={toneFor("cpm", data.money.cpm)} />} />
              <Row label="Cost per opt-in" value={<KpiValue value={data.money.costPerOptIn} format="currency" tone={toneFor("costPerOptIn", data.money.costPerOptIn)} />} />
              <Row label="Cost per live attendee" value={<KpiValue value={data.money.costPerAttendee} format="currency" />} />
              <Row label="Cost per booked call" value={<KpiValue value={data.money.costPerBooked} format="currency" />} />
              <Row label="Cost per close" value={<KpiValue value={data.money.costPerClose} format="currency" />} />
            </dl>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Organic has no ad spend. Switch to Paid or All to see cost per step.</p>
          )}
        </Panel>
      </div>

      {/* Per webinar */}
      <Panel className="overflow-hidden p-0">
        <div className="border-b border-[var(--panel-border)] px-5 py-4 text-[15px] font-semibold text-[var(--text-strong)]">Webinars in this range</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-5 py-3 font-medium">Webinar</th>
                <th className="px-3 py-3 text-right font-medium">Registered</th>
                <th className="px-3 py-3 text-right font-medium">Attended</th>
                <th className="px-3 py-3 text-right font-medium">Booked</th>
                <th className="px-3 py-3 text-right font-medium">Closed</th>
                <th className="px-5 py-3 text-right font-medium">Cash</th>
              </tr>
            </thead>
            <tbody>
              {(data?.webinars ?? []).map((w) => (
                <tr key={w.number} className="border-t border-[var(--panel-border)]">
                  <td className="px-5 py-2.5 font-medium text-[var(--text-strong)]">
                    #{w.number} · {w.date}
                    {w.status === "upcoming" ? <span className="ml-2 text-[11px] text-[var(--text-muted)]">upcoming</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{w.registered}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{w.attended}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{w.booked}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{w.closed}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{formatStatValue(w.cash, "currency")}</td>
                </tr>
              ))}
              {data && data.webinars.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-[var(--text-muted)]">No webinars held in this range.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
