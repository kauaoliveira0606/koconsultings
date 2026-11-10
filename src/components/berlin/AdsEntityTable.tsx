"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/berlin/Berlin";
import { KpiValue, Sparkline, toneFor, type KpiKey } from "@/components/berlin/kpi";
import type { StatFormat } from "@/lib/format";
import type { AdsEntity } from "@/lib/ads-cortana";

type Col = {
  key: keyof AdsEntity;
  label: string;
  format: StatFormat;
  kpi?: KpiKey;
  title?: string;
};

/** The "webinar" column set: spend -> creative -> landing page -> opt-in -> call -> cash. */
const COLS: Col[] = [
  { key: "spend", label: "Spend", format: "currency" },
  { key: "cpm", label: "CPM", format: "currency", kpi: "cpm" },
  { key: "linkCtr", label: "Link CTR", format: "percent", kpi: "linkCtr" },
  { key: "hookRate", label: "Hook", format: "percent", kpi: "hookRate", title: "3-second views ÷ impressions" },
  { key: "holdRate", label: "Hold", format: "percent", kpi: "holdRate", title: "ThruPlays ÷ 3-second views" },
  { key: "lpConnectRate", label: "LP connect", format: "percent", kpi: "lpConnectRate", title: "Landing page views ÷ link clicks" },
  { key: "registrations", label: "Opt-ins", format: "number", title: "Webinar registrations (CompleteRegistration)" },
  { key: "optInRate", label: "Opt-in rate", format: "percent", kpi: "optInRate", title: "Opt-ins ÷ landing page views" },
  { key: "costPerOptIn", label: "Cost / opt-in", format: "currency", kpi: "costPerOptIn" },
  { key: "booked", label: "Booked", format: "number" },
  { key: "costPerBooked", label: "Cost / booked", format: "currency" },
  { key: "callsHeld", label: "Calls held", format: "number", title: "Post call notes logged" },
  { key: "sales", label: "Sales", format: "number" },
  { key: "revenue", label: "Revenue", format: "currency" },
  { key: "roas", label: "ROAS", format: "ratio", kpi: "roas" },
  { key: "frequency", label: "Freq", format: "number", kpi: "frequency" },
];

export function AdsEntityTable({ title, subtitle, rows, dates, flat }: { title: string; subtitle?: string; rows: AdsEntity[]; dates: string[]; flat?: boolean }) {
  const [sortKey, setSortKey] = useState<keyof AdsEntity>("spend");
  const [desc, setDesc] = useState(true);
  const [q, setQ] = useState("");
  const [hideIdle, setHideIdle] = useState(true);

  const shown = useMemo(() => {
    const list = rows.filter((r) => (!hideIdle || r.spend > 0) && (!q || r.name.toLowerCase().includes(q.toLowerCase())));
    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av === "number" ? av : av == null ? -Infinity : String(av);
      const bn = typeof bv === "number" ? bv : bv == null ? -Infinity : String(bv);
      const cmp = an < bn ? -1 : an > bn ? 1 : 0;
      return desc ? -cmp : cmp;
    });
  }, [rows, sortKey, desc, q, hideIdle]);

  const totals = useMemo(() => {
    const s = (k: keyof AdsEntity) => shown.reduce((acc, r) => acc + ((r[k] as number) || 0), 0);
    return { spend: s("spend"), registrations: s("registrations"), booked: s("booked"), sales: s("sales"), revenue: s("revenue") };
  }, [shown]);

  function sortBy(k: keyof AdsEntity) {
    if (k === sortKey) setDesc(!desc);
    else {
      setSortKey(k);
      setDesc(true);
    }
  }

  return (
    <Panel className={`${flat ? "rounded-none border-0" : "mb-6"} overflow-hidden p-0`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-border)] px-5 py-4">
        <div>
          <div className="text-[15px] font-semibold text-[var(--text-strong)]">{title}</div>
          {subtitle ? <div className="text-[12px] text-[var(--text-muted)]">{subtitle}</div> : null}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
            <input type="checkbox" checked={hideIdle} onChange={(e) => setHideIdle(e.target.checked)} />
            Only with spend
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="w-40 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1500px] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
              <th className="sticky left-0 z-10 bg-[var(--panel-bg)] px-5 py-3 font-medium">Name</th>
              {dates.length > 1 ? <th className="px-3 py-3 font-medium">Trend</th> : null}
              {COLS.map((c) => (
                <th key={c.key} className="px-3 py-3 text-right font-medium" title={c.title}>
                  <button onClick={() => sortBy(c.key)} className={`uppercase ${sortKey === c.key ? "text-[var(--text-strong)]" : ""}`}>
                    {c.label}
                    {sortKey === c.key ? (desc ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              const byDate = new Map(r.daily.map((d) => [d.date, d.spend]));
              return (
                <tr key={r.entityId} className="border-t border-[var(--panel-border)]">
                  <td className="sticky left-0 z-10 max-w-[300px] bg-[var(--panel-bg)] px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      {i === 0 && sortKey === "spend" && desc ? (
                        <span className="rounded bg-black px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Top spend</span>
                      ) : null}
                      <span className="truncate font-medium text-[var(--text-strong)]" title={r.name}>{r.name}</span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {r.parent ? <span title={r.parent}>{r.parent.length > 38 ? `${r.parent.slice(0, 38)}…` : r.parent} · </span> : null}
                      {r.status || "—"}
                      {r.spendShare != null ? ` · ${(r.spendShare * 100).toFixed(0)}% of spend` : ""}
                    </div>
                  </td>
                  {dates.length > 1 ? (
                    <td className="px-3 py-2.5">
                      <Sparkline values={dates.map((d) => byDate.get(d) ?? 0)} />
                    </td>
                  ) : null}
                  {COLS.map((c) => {
                    const v = r[c.key] as number | null;
                    return (
                      <td key={c.key} className="px-3 py-2.5 text-right">
                        <KpiValue value={v} format={c.format} tone={c.kpi && r.spend > 0 ? toneFor(c.kpi, v) : null} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {shown.length === 0 ? (
              <tr><td colSpan={COLS.length + 2} className="px-5 py-8 text-center text-[var(--text-muted)]">Nothing here{hideIdle ? " with spend. Untick \"Only with spend\" to see the rest" : ""}.</td></tr>
            ) : (
              <tr className="border-t-2 border-[var(--panel-border)] font-semibold">
                <td className="sticky left-0 z-10 bg-[var(--panel-bg)] px-5 py-2.5 text-[var(--text-strong)]">Total ({shown.length})</td>
                {dates.length > 1 ? <td /> : null}
                {COLS.map((c) => {
                  const t =
                    c.key === "spend" ? totals.spend
                    : c.key === "registrations" ? totals.registrations
                    : c.key === "booked" ? totals.booked
                    : c.key === "sales" ? totals.sales
                    : c.key === "revenue" ? totals.revenue
                    : c.key === "costPerOptIn" ? (totals.registrations ? totals.spend / totals.registrations : null)
                    : c.key === "costPerBooked" ? (totals.booked ? totals.spend / totals.booked : null)
                    : c.key === "roas" ? (totals.spend ? totals.revenue / totals.spend : null)
                    : undefined;
                  return (
                    <td key={c.key} className="px-3 py-2.5 text-right">
                      {t === undefined ? null : <KpiValue value={t} format={c.format} tone={c.kpi ? toneFor(c.kpi, t) : null} bold />}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
