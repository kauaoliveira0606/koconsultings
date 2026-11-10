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

/** The user's Cortana "webinar" column set, same order (screenshot 2026-11-10). Status sits under the name. */
const COLS: Col[] = [
  { key: "dailyBudget", label: "Budget", format: "currency" },
  { key: "spend", label: "Spent", format: "currency" },
  { key: "reach", label: "Reach", format: "number" },
  { key: "impressions", label: "Impressions", format: "number" },
  { key: "hookRate", label: "Hook rate", format: "percent", kpi: "hookRate", title: "3-second views ÷ impressions (Cortana)" },
  { key: "holdRate", label: "Hold rate", format: "percent", kpi: "holdRate", title: "Cortana hold rate" },
  { key: "frequency", label: "Frequency", format: "number", kpi: "frequency" },
  { key: "cpm", label: "CPM", format: "currency", kpi: "cpm" },
  { key: "costPerLinkClick", label: "Cost per link click", format: "currency" },
  { key: "uniqueLinkClicks", label: "Unique link clicks", format: "number" },
  { key: "linkCtr", label: "LCTR", format: "percent", kpi: "linkCtr", title: "Unique link clicks ÷ impressions" },
  { key: "lpViews", label: "Landing page views", format: "number" },
  { key: "lpConnectRate", label: "LP connect", format: "percent", kpi: "lpConnectRate", title: "Landing page views ÷ link clicks" },
  { key: "registrations", label: "Complete registrations", format: "number", title: "Unique people who registered" },
  { key: "costPerOptIn", label: "Cost per complete reg.", format: "currency", kpi: "costPerOptIn" },
  { key: "optInRate", label: "Opt-in rate", format: "percent", kpi: "optInRate", title: "Complete registrations ÷ landing page views. Blank when registrations outnumber page views (Cortana credits late opt-ins to an earlier click)." },
  { key: "booked", label: "Schedule", format: "number", title: "Calls booked" },
  { key: "costPerBooked", label: "Cost per schedule", format: "currency" },
  { key: "htSales", label: "High ticket", format: "number" },
  { key: "htRevenue", label: "High ticket revenue", format: "currency" },
  { key: "roas", label: "ROAS", format: "ratio", kpi: "roas", title: "Revenue ÷ spent" },
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
    return {
      spend: s("spend"), reach: s("reach"), impressions: s("impressions"), linkClicks: s("linkClicks"), uniqueLinkClicks: s("uniqueLinkClicks"),
      lpViews: s("lpViews"), registrations: s("registrations"), booked: s("booked"), htSales: s("htSales"), htRevenue: s("htRevenue"), revenue: s("revenue"),
    };
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
        <table className="w-full min-w-[2200px] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
              <th className="sticky left-0 z-10 bg-[var(--panel-bg)] px-5 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Status</th>
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
              const byDate = new Map((Array.isArray(r.daily) ? r.daily : []).map((d) => [d.date, d.spend]));
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
                      {r.spendShare != null ? ` · ${(r.spendShare * 100).toFixed(0)}% of spend` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${/active/i.test(r.status) ? "bg-[var(--cell-green-bg)] text-[var(--cell-green-text)]" : "bg-[var(--panel-subtle)] text-[var(--text-muted)]"}`}>
                      {r.status ? r.status.charAt(0) + r.status.slice(1).toLowerCase().replace(/_/g, " ") : "—"}
                    </span>
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
              <tr><td colSpan={COLS.length + 3} className="px-5 py-8 text-center text-[var(--text-muted)]">Nothing here{hideIdle ? " with spend. Untick \"Only with spend\" to see the rest" : ""}.</td></tr>
            ) : (
              <tr className="border-t-2 border-[var(--panel-border)] font-semibold">
                <td className="sticky left-0 z-10 bg-[var(--panel-bg)] px-5 py-2.5 text-[var(--text-strong)]">Total ({shown.length})</td>
                <td />
                {dates.length > 1 ? <td /> : null}
                {COLS.map((c) => {
                  const T = totals;
                  const sums: Partial<Record<keyof AdsEntity, number | null>> = {
                    spend: T.spend, reach: T.reach, impressions: T.impressions, uniqueLinkClicks: T.uniqueLinkClicks, lpViews: T.lpViews,
                    registrations: T.registrations, booked: T.booked, htSales: T.htSales, htRevenue: T.htRevenue,
                    cpm: T.impressions ? (T.spend / T.impressions) * 1000 : null,
                    costPerLinkClick: T.linkClicks ? T.spend / T.linkClicks : null,
                    linkCtr: T.impressions ? T.uniqueLinkClicks / T.impressions : null,
                    lpConnectRate: T.linkClicks ? T.lpViews / T.linkClicks : null,
                    costPerOptIn: T.registrations ? T.spend / T.registrations : null,
                    optInRate: T.lpViews && T.lpViews >= T.registrations ? T.registrations / T.lpViews : null,
                    costPerBooked: T.booked ? T.spend / T.booked : null,
                    roas: T.spend ? T.revenue / T.spend : null,
                  };
                  const t = c.key in sums ? sums[c.key] : undefined;
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
