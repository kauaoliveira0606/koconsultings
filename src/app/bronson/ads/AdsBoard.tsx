"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { StatCard } from "@/components/dashboard/StatCard";
import { Panel, EmptyState } from "@/components/berlin/Berlin";
import { PacePanel } from "@/components/berlin/PacePanel";
import { AdsEntityTable } from "@/components/berlin/AdsEntityTable";
import { KpiValue, toneFor } from "@/components/berlin/kpi";
import { formatStatValue } from "@/lib/format";
import type { AdsEntity } from "@/lib/ads-cortana";

type SourceRow = { source: string; class: "Paid" | "Organic"; revenue: number; leads: number; purchases: number };
type DayRow = { date: string; total: AdsEntity | null; campaigns: AdsEntity[]; ads: AdsEntity[] };

type AdsData = {
  totals: {
    adSpend: number;
    paidRevenue: number;
    organicRevenue: number;
    totalRevenue: number;
    paidRoas: number | null;
    costPerLeadPaid: number | null;
    leads: number;
    paidLeads: number;
  };
  sources: SourceRow[];
  campaigns: AdsEntity[];
  ads: AdsEntity[];
  byDay: DayRow[];
  cortanaSpend: number;
  lastSpendDate: string | null;
  hasData: boolean;
};
type AdsetData = { ok: boolean; error?: string; adsets: AdsEntity[]; byDay: { date: string; adsets: AdsEntity[] }[] };

type Level = "campaigns" | "adsets" | "ads";
const LEVELS: { id: Level; label: string }[] = [
  { id: "campaigns", label: "Campaigns" },
  { id: "adsets", label: "Ad sets" },
  { id: "ads", label: "Ads" },
];

function datesOf(rows: AdsEntity[]): string[] {
  return [...new Set(rows.flatMap((r) => (Array.isArray(r.daily) ? r.daily : []).map((d) => d.date)))].sort();
}

function Toggle<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <div className="flex rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1.5 text-[13px] font-semibold ${value === o.id ? "bg-black text-white" : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function sumEntities(rows: AdsEntity[]) {
  const s = (k: keyof AdsEntity) => rows.reduce((a, r) => a + ((r[k] as number) || 0), 0);
  const spend = s("spend");
  const impressions = s("impressions");
  const ulc = s("uniqueLinkClicks");
  const lc = s("linkClicks");
  const lpv = s("lpViews");
  const reg = s("registrations");
  const booked = s("booked");
  return {
    spend,
    impressions,
    cpm: impressions ? (spend / impressions) * 1000 : null,
    linkCtr: impressions ? ulc / impressions : null,
    lpViews: lpv,
    lpConnect: lc ? lpv / lc : null,
    registrations: reg,
    costPerReg: reg && spend ? spend / reg : null,
    optInRate: lpv && lpv >= reg ? reg / lpv : null,
    booked,
    costPerBooked: booked && spend ? spend / booked : null,
    htSales: s("htSales"),
    htRevenue: s("htRevenue"),
    roas: spend ? s("revenue") / spend : null,
  };
}

function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function AdsBoard() {
  const { range, setRange } = useSharedRange();
  const { data, isLoading } = useSectionData<AdsData>("/api/bronson/ads", range, 300_000);
  const { data: adsetData, isLoading: adsetLoading } = useSectionData<AdsetData>("/api/bronson/ads/adsets", range, 300_000);
  const [level, setLevel] = useState<Level>("campaigns");
  const [view, setView] = useState<"totals" | "days">("totals");
  const [openDay, setOpenDay] = useState<string | null>(null);

  // Guard every list: a cached answer from an older build may not have them.
  const list = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);
  const campaigns = list(data?.campaigns);
  const adsList = list(data?.ads);
  const adsets = list(adsetData?.adsets);
  const t = data?.totals;
  const top = campaigns.find((c) => c.spend > 0) ?? null;
  const topAd = adsList.find((c) => c.spend > 0) ?? null;
  const dates = datesOf([...campaigns, ...adsList]);

  const levelRows: AdsEntity[] = level === "campaigns" ? campaigns : level === "ads" ? adsList : adsets;
  const adsetBlocked = level === "adsets" && adsetData && !adsetData.ok;

  // Day rows for the chosen level.
  const days: { date: string; rows: AdsEntity[] }[] =
    level === "adsets"
      ? list(adsetData?.byDay).map((d) => ({ date: d.date, rows: list(d.adsets) }))
      : list(data?.byDay).map((d) => ({ date: d.date, rows: list(level === "campaigns" ? d.campaigns : d.ads) }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)]">Ads</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Every campaign, ad set and ad with what it spent and what it brought back, in total or day by day.</p>
        </div>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ad spend" value={t?.adSpend ?? null} format="currency" subtext="Meta spend, from the daily form." />
        <StatCard label="Revenue (paid)" value={t?.paidRevenue ?? null} format="currency" subtext="Revenue attributed to paid sources (Cortana)." />
        <StatCard label="Paid ROAS" value={t?.paidRoas ?? null} format="ratio" subtext="Paid revenue ÷ ad spend." status={toneFor("roas", t?.paidRoas)} />
        <StatCard label="Cost per lead (paid)" value={t?.costPerLeadPaid ?? null} format="currency" subtext="Ad spend ÷ paid leads." />
      </div>

      {top ? (
        <Panel className="mb-6">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Spending the most</div>
          <div className="mt-1 text-lg font-bold text-[var(--text-strong)]">{top.name}</div>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Mini label="Spend" value={<KpiValue value={top.spend} format="currency" bold />} sub={top.spendShare != null ? `${(top.spendShare * 100).toFixed(0)}% of all spend` : undefined} />
            <Mini label="Complete registrations" value={<KpiValue value={top.registrations} format="number" bold />} sub={top.optInRate != null ? `${formatStatValue(top.optInRate, "percent")} opt-in rate` : undefined} />
            <Mini label="Cost per complete reg." value={<KpiValue value={top.costPerOptIn} format="currency" tone={toneFor("costPerOptIn", top.costPerOptIn)} bold />} />
            <Mini label="Schedule" value={<KpiValue value={top.booked} format="number" bold />} sub={top.costPerBooked != null ? `${formatStatValue(top.costPerBooked, "currency")} per schedule` : undefined} />
            <Mini label="High ticket revenue" value={<KpiValue value={top.htRevenue} format="currency" bold />} sub={`${top.htSales} high ticket`} />
            <Mini label="ROAS" value={<KpiValue value={top.roas} format="ratio" tone={toneFor("roas", top.roas)} bold />} />
          </div>
          {topAd ? (
            <p className="mt-4 text-[13px] text-[var(--text-muted)]">
              Top ad: <span className="font-semibold text-[var(--text-strong)]">{topAd.name}</span> · {formatStatValue(topAd.spend, "currency")} spend ·{" "}
              {topAd.registrations} complete registrations at {formatStatValue(topAd.costPerOptIn, "currency")} · {topAd.booked} scheduled · {formatStatValue(topAd.htRevenue, "currency")} high ticket revenue
            </p>
          ) : null}
        </Panel>
      ) : null}

      {/* Breakdown controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="text-[15px] font-semibold text-[var(--text-strong)]">Breakdown</div>
        <Toggle value={level} onChange={(v) => { setLevel(v); setOpenDay(null); }} options={LEVELS} />
        <Toggle value={view} onChange={setView} options={[{ id: "totals", label: "Totals" }, { id: "days", label: "By day" }]} />
      </div>

      {adsetBlocked ? (
        <EmptyState
          title="Ad sets need a working Meta connection"
          body="Cortana can't split by ad set, so ad sets come straight from Meta. The Meta token on the Bronson site is being rejected right now, so this view fills in as soon as it's replaced."
          hint={`Meta says: ${adsetData?.error ?? "unknown error"}`}
        />
      ) : level === "adsets" && adsetLoading && !adsetData ? (
        <Panel className="mb-6"><p className="text-sm text-[var(--text-muted)]">Loading ad sets from Meta…</p></Panel>
      ) : !isLoading && data && !data.hasData && level !== "adsets" ? (
        <EmptyState title="No ad numbers in this range" body="No ad spend or attributed revenue for the selected dates. Widen the range, or wait for the next sync." />
      ) : view === "totals" ? (
        <AdsEntityTable
          title={LEVELS.find((l) => l.id === level)!.label}
          subtitle="Sorted by spend. Click a column to sort. Colors use your KPI lines."
          rows={levelRows}
          dates={level === "adsets" ? datesOf(levelRows) : dates}
        />
      ) : (
        <Panel className="mb-6 overflow-hidden p-0">
          <div className="border-b border-[var(--panel-border)] px-5 py-4">
            <div className="text-[15px] font-semibold text-[var(--text-strong)]">By day</div>
            <div className="text-[12px] text-[var(--text-muted)]">Newest first. Click a day to see its {LEVELS.find((l) => l.id === level)!.label.toLowerCase()}.</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-5 py-3 font-medium">Day</th>
                  {["Spent", "Impressions", "CPM", "LCTR", "Landing page views", "LP connect", "Complete reg.", "Cost per reg.", "Opt-in rate", "Schedule", "Cost per schedule", "High ticket", "HT revenue", "ROAS"].map((h) => (
                    <th key={h} className="px-3 py-3 text-right font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const s = sumEntities(d.rows);
                  const open = openDay === d.date;
                  return (
                    <Fragment key={d.date}>
                      <tr onClick={() => setOpenDay(open ? null : d.date)} className="cursor-pointer border-t border-[var(--panel-border)] hover:bg-[var(--panel-subtle)]">
                        <td className="px-5 py-2.5 font-medium text-[var(--text-strong)]">
                          <span className="inline-flex items-center gap-1.5">
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {weekday(d.date)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right"><KpiValue value={s.spend} format="currency" /></td>
                        <td className="px-3 py-2.5 text-right"><KpiValue value={s.impressions} format="number" /></td>
                        <td className="px-3 py-2.5 text-right"><KpiValue value={s.cpm} format="currency" tone={s.spend ? toneFor("cpm", s.cpm) : null} /></td>
                        <td className="px-3 py-2.5 text-right"><KpiValue value={s.linkCtr} format="percent" tone={s.spend ? toneFor("linkCtr", s.linkCtr) : null} /></td>
                        <td className="px-3 py-2.5 text-right"><KpiValue value={s.lpViews} format="number" /></td>
                        <td className="px-3 py-2.5 text-right"><KpiValue value={s.lpConnect} format="percent" tone={s.spend ? toneFor("lpConnectRate", s.lpConnect) : null} /></td>
                        <td className="px-3 py-2.5 text-right"><KpiValue value={s.registrations} format="number" /></td>
                        <td className="px-3 py-2.5 text-right"><KpiValue value={s.costPerReg} format="currency" tone={toneFor("costPerOptIn", s.costPerReg)} /></td>
                        <td className="px-3 py-2.5 text-right"><KpiValue value={s.optInRate} format="percent" tone={s.spend ? toneFor("optInRate", s.optInRate) : null} /></td>
                        <td className="px-3 py-2.5 text-right"><KpiValue value={s.booked} format="number" /></td>
                        <td className="px-3 py-2.5 text-right"><KpiValue value={s.costPerBooked} format="currency" /></td>
                        <td className="px-3 py-2.5 text-right"><KpiValue value={s.htSales} format="number" /></td>
                        <td className="px-3 py-2.5 text-right"><KpiValue value={s.htRevenue} format="currency" /></td>
                        <td className="px-5 py-2.5 text-right"><KpiValue value={s.roas} format="ratio" tone={s.spend ? toneFor("roas", s.roas) : null} /></td>
                      </tr>
                      {open ? (
                        <tr>
                          <td colSpan={15} className="border-t border-[var(--panel-border)] bg-[var(--panel-subtle)] p-0">
                            <AdsEntityTable flat title={`${weekday(d.date)} · ${LEVELS.find((l) => l.id === level)!.label}`} rows={d.rows} dates={[d.date]} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                {days.length === 0 ? (
                  <tr><td colSpan={15} className="px-5 py-8 text-center text-[var(--text-muted)]">No days in this range.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel className="mb-6 overflow-hidden p-0">
        <div className="border-b border-[var(--panel-border)] px-6 py-4 text-[15px] font-semibold text-[var(--text-strong)]">Revenue by source</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-6 py-3 font-medium">Source</th>
                <th className="px-6 py-3 font-medium">Class</th>
                <th className="px-6 py-3 text-right font-medium">Revenue</th>
                <th className="px-6 py-3 text-right font-medium">Leads</th>
              </tr>
            </thead>
            <tbody>
              {list(data?.sources).map((s) => (
                <tr key={s.source} className="border-t border-[var(--panel-border)]">
                  <td className="px-6 py-3.5 font-medium text-[var(--text-strong)]">{s.source}</td>
                  <td className="px-6 py-3.5 text-[var(--text-muted)]">{s.class}</td>
                  <td className="px-6 py-3.5 text-right tabular-nums">{formatStatValue(s.revenue, "currency")}</td>
                  <td className="px-6 py-3.5 text-right tabular-nums">{s.leads}</td>
                </tr>
              ))}
              {!data && isLoading ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-[var(--text-muted)]">Loading…</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <PacePanel />

      <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
        Top cards: ad spend from the Marketing Daily Metrics form (source of truth for total spend). Campaign, ad set and ad rows: Cortana, synced hourly
        {data?.lastSpendDate ? `; spend posted through ${data.lastSpendDate}` : ""}. Cortana&rsquo;s campaign spend can differ from the form total
        {data ? ` (${formatStatValue(data.cortanaSpend, "currency")} in this range)` : ""}.
      </p>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <div className="text-[12px] text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 text-[1.15rem]">{value}</div>
      {sub ? <div className="text-[11px] text-[var(--text-muted)]">{sub}</div> : null}
    </div>
  );
}
