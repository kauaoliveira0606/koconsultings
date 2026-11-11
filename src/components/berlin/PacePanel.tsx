"use client";

import useSWR from "swr";
import { Panel } from "@/components/berlin/Berlin";
import { KpiValue, toneFor } from "@/components/berlin/kpi";
import { formatStatValue } from "@/lib/format";

type Window = { leads: number; registrations: number; booked: number; sales: number; revenue: number };
type PaceCampaign = {
  entityId: string;
  name: string;
  status: string;
  dailyBudget: number | null;
  last3h: Window;
  pacePerHour: number;
  yesterdayPerHour: number;
  spendYesterday: number;
  registrationsYesterday: number;
  cplYesterday: number | null;
  cpl3d: number | null;
  roasYesterday: number | null;
  action: "scale" | "hold" | "watch" | "cut" | "paused";
  reason: string;
};
type PaceData = {
  window: { from: string; to: string; latestSynced: string | null };
  last3h: Window;
  prev3h: Window;
  sameHoursYesterday: Window;
  yesterday: { spend: number; registrations: number; cpl: number | null };
  byHour: { hour: number; today: number; yesterday: number }[];
  campaigns: PaceCampaign[];
  rules: { cplGood: number; cplBad: number };
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ACTION: Record<PaceCampaign["action"], { label: string; style: React.CSSProperties }> = {
  scale: { label: "Scale +20%", style: { background: "var(--cell-green-bg)", color: "var(--cell-green-text)" } },
  hold: { label: "Hold", style: { background: "var(--panel-subtle)", color: "var(--text-strong)" } },
  watch: { label: "Watch", style: { background: "var(--cell-yellow-bg)", color: "var(--cell-yellow-text)" } },
  cut: { label: "Cut", style: { background: "var(--cell-red-bg)", color: "var(--cell-red-text)" } },
  paused: { label: "Paused", style: { background: "var(--panel-subtle)", color: "var(--text-muted)" } },
};

function hourLabel(h: number) {
  const s = h % 12 === 0 ? 12 : h % 12;
  return `${s}${h < 12 ? "a" : "p"}`;
}
function hourOf(label: string) {
  return hourLabel(Number(label.slice(11, 13)));
}

function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  if (!before && !now) return <span className="text-[12px] text-[var(--text-muted)]">{label}: 0</span>;
  const pct = before ? (now - before) / before : null;
  const up = pct === null ? now > 0 : pct >= 0;
  return (
    <span className={`text-[12px] font-semibold ${up ? "text-emerald-700" : "text-rose-600"}`}>
      {pct === null ? "new" : `${up ? "▲" : "▼"} ${Math.abs(pct * 100).toFixed(0)}%`}{" "}
      <span className="font-normal text-[var(--text-muted)]">{label}</span>
    </span>
  );
}

/** Manos-style 3-hour pace: last three finished hours, hour-by-hour opt-ins, and a budget call per campaign. */
export function PacePanel() {
  const { data: raw } = useSWR<PaceData>("/api/bronson/ads/pace", fetcher, { refreshInterval: 120_000 });
  // Only draw a complete answer (a copy saved by an older build may be missing pieces).
  const data =
    raw && raw.window && raw.last3h && raw.prev3h && raw.sameHoursYesterday && raw.yesterday && Array.isArray(raw.byHour) && Array.isArray(raw.campaigns) && raw.rules
      ? raw
      : null;

  if (!data) {
    return (
      <Panel className="mb-6">
        <div className="text-[15px] font-semibold text-[var(--text-strong)]">3-hour pace</div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Loading…</p>
      </Panel>
    );
  }

  const w = data.last3h;
  const cpl3h = data.yesterday.cpl;
  const maxBar = Math.max(1, ...data.byHour.map((h) => Math.max(h.today, h.yesterday)));
  const nowHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(new Date()),
  );

  return (
    <Panel className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[15px] font-semibold text-[var(--text-strong)]">3-hour pace</div>
          <div className="text-[12px] text-[var(--text-muted)]">
            {hourOf(data.window.from)} to {hourLabel((Number(data.window.to.slice(11, 13)) + 1) % 24)} ET, last three finished hours
            {data.window.latestSynced ? ` · synced through ${hourOf(data.window.latestSynced)}` : ""}
          </div>
        </div>
        <div className="text-[12px] text-[var(--text-muted)]">Refreshes hourly from Cortana</div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Opt-ins (3h)" value={formatStatValue(w.registrations, "number")}>
          <Delta now={w.registrations} before={data.prev3h.registrations} label="vs prior 3h" />
          <Delta now={w.registrations} before={data.sameHoursYesterday.registrations} label="vs yesterday" />
        </Stat>
        <Stat label="Opt-ins per hour" value={(w.registrations / 3).toFixed(1)}>
          <span className="text-[12px] text-[var(--text-muted)]">yesterday averaged {(data.yesterday.registrations / 24).toFixed(1)}/h</span>
        </Stat>
        <Stat label="Calls booked (3h)" value={formatStatValue(w.booked, "number")}>
          <Delta now={w.booked} before={data.prev3h.booked} label="vs prior 3h" />
        </Stat>
        <Stat label="Cash attributed (3h)" value={formatStatValue(w.revenue, "currency")}>
          <span className="text-[12px] text-[var(--text-muted)]">{w.sales} sale{w.sales === 1 ? "" : "s"}</span>
        </Stat>
        <Stat label="Cost per opt-in (yesterday)" value={<KpiValue value={cpl3h} format="currency" tone={toneFor("costPerOptIn", cpl3h)} />}>
          <span className="text-[12px] text-[var(--text-muted)]">{formatStatValue(data.yesterday.spend, "currency")} spend</span>
        </Stat>
      </div>

      {/* Opt-ins by hour, today vs yesterday */}
      <div className="mt-6">
        <div className="mb-2 flex items-center gap-4 text-[12px] text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-strong)]">Opt-ins by hour</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent)]" />Today</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-neutral-300" />Yesterday</span>
        </div>
        <div className="flex h-24 items-end gap-[3px]">
          {data.byHour.map((h) => (
            <div key={h.hour} className="group relative flex h-full flex-1 items-end gap-[1px]" title={`${hourLabel(h.hour)}: today ${h.today}, yesterday ${h.yesterday}`}>
              <div className="flex-1 rounded-t-sm bg-neutral-300" style={{ height: `${(h.yesterday / maxBar) * 100}%` }} />
              <div
                className="flex-1 rounded-t-sm bg-[var(--accent)]"
                style={{ height: `${(h.today / maxBar) * 100}%`, opacity: h.hour > nowHour ? 0 : 1 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-[3px] text-[10px] text-[var(--text-muted)]">
          {data.byHour.map((h) => (
            <div key={h.hour} className="flex-1 text-center">{h.hour % 3 === 0 ? hourLabel(h.hour) : ""}</div>
          ))}
        </div>
      </div>

      {/* Budget calls */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
              <th className="py-2 pr-3 font-medium">Campaign</th>
              <th className="px-3 py-2 text-right font-medium">Budget</th>
              <th className="px-3 py-2 text-right font-medium">Spend yday</th>
              <th className="px-3 py-2 text-right font-medium">Opt-ins 3h</th>
              <th className="px-3 py-2 text-right font-medium">Pace/h vs yday</th>
              <th className="px-3 py-2 text-right font-medium">CPL yday</th>
              <th className="px-3 py-2 text-right font-medium">CPL 3 days</th>
              <th className="px-3 py-2 text-right font-medium">ROAS yday</th>
              <th className="py-2 pl-3 font-medium">Call</th>
            </tr>
          </thead>
          <tbody>
            {data.campaigns.map((c) => (
              <tr key={c.entityId} className="border-t border-[var(--panel-border)] align-top">
                <td className="max-w-[280px] py-2.5 pr-3">
                  <div className="truncate font-medium text-[var(--text-strong)]" title={c.name}>{c.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{c.status || "—"}</div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatStatValue(c.dailyBudget, "currency")}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatStatValue(c.spendYesterday, "currency")}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{c.last3h.registrations}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {c.pacePerHour.toFixed(1)} <span className="text-[var(--text-muted)]">/ {c.yesterdayPerHour.toFixed(1)}</span>
                </td>
                <td className="px-3 py-2.5 text-right"><KpiValue value={c.cplYesterday} format="currency" tone={toneFor("costPerOptIn", c.cplYesterday)} /></td>
                <td className="px-3 py-2.5 text-right"><KpiValue value={c.cpl3d} format="currency" tone={toneFor("costPerOptIn", c.cpl3d)} /></td>
                <td className="px-3 py-2.5 text-right"><KpiValue value={c.roasYesterday} format="ratio" tone={toneFor("roas", c.roasYesterday)} /></td>
                <td className="py-2.5 pl-3">
                  <span className="inline-block rounded-md px-2 py-0.5 text-[12px] font-bold" style={ACTION[c.action].style} title={c.reason}>
                    {ACTION[c.action].label}
                  </span>
                  <div className="mt-1 max-w-[220px] text-[11px] leading-snug text-[var(--text-muted)]">{c.reason}</div>
                </td>
              </tr>
            ))}
            {data.campaigns.length === 0 ? (
              <tr><td colSpan={9} className="py-6 text-center text-[var(--text-muted)]">No campaign activity in the last 3 days.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
        Calls are recommendations only. Spend by the hour isn&rsquo;t available from Cortana, so budget calls use yesterday&rsquo;s and the 3-day cost per registration. Goal: under ${data.rules.cplGood}, red over ${data.rules.cplBad}.
      </p>
    </Panel>
  );
}

function Stat({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-subtle)] p-3">
      <div className="text-[12px] font-medium text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-[1.4rem] font-bold leading-tight text-[var(--text-strong)]">{value}</div>
      <div className="mt-1 flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
