"use client";

import { useState } from "react";
import useSWR from "swr";
import { formatStatValue } from "@/lib/format";
import type { AttributionBucket, AttributionGranularity } from "@/lib/attribution";
import type { AttributionByRepResponse } from "@/lib/attribution-by-rep";
import { cellStatus } from "@/lib/weekly-scorecard";

type AttributionResponse = {
  brands: string[];
  month: AttributionBucket[];
  week: AttributionBucket[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_DOT = {
  green: "var(--cell-green-bg)",
  yellow: "var(--cell-yellow-bg)",
  red: "var(--cell-red-bg)",
} as const;

const THEME = {
  light: {
    card: "rounded-lg border border-black/10 bg-white p-4",
    control: "rounded-md border border-black/15 bg-white px-2 py-1 text-sm text-black",
    toggleOn: "bg-black text-white",
    toggleOff: "bg-black/5 text-black/70",
    rate: "text-3xl font-bold text-black",
    label: "text-xs font-semibold uppercase tracking-wide text-black/60",
    muted: "text-xs text-black/50",
    value: "text-lg font-semibold text-black",
    divider: "border-black/10",
  },
  dark: {
    card: "rounded-lg border border-white/10 bg-[#111826] p-4",
    control: "rounded-md border border-white/15 bg-[#0b1220] px-2 py-1 text-sm text-white",
    toggleOn: "bg-emerald-500 text-black",
    toggleOff: "bg-white/5 text-white/70",
    rate: "text-3xl font-bold font-mono text-emerald-400",
    label: "text-xs font-semibold uppercase tracking-wide text-white/70",
    muted: "text-xs text-white/50",
    value: "text-lg font-semibold font-mono text-white",
    divider: "border-white/10",
  },
  deepspace: {
    card: "rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm",
    control:
      "rounded-md border border-[var(--panel-border)] bg-[var(--panel-subtle)] px-2 py-1 text-sm text-[var(--text-strong)]",
    toggleOn: "bg-[var(--accent)] text-[#050912]",
    toggleOff: "bg-[var(--panel-subtle)] text-[var(--text-muted)]",
    rate: "text-3xl font-bold font-mono text-[var(--accent)]",
    label: "text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
    muted: "text-xs text-[var(--text-muted)]",
    value: "text-lg font-semibold font-mono text-[var(--text-strong)]",
    divider: "border-[var(--panel-border)]",
  },
} as const;

export function AttributionSection({
  apiPath,
  theme = "light",
  brandLabel,
  goal,
  byRepPath,
}: {
  apiPath: string;
  theme?: "light" | "dark" | "deepspace";
  brandLabel: string;
  /** Minimum attribution rate target; same green/yellow/red scale as StatCard. */
  goal?: number | null;
  /** Endpoint for the per-rep split of the selected period. Omit to hide it. */
  byRepPath?: string;
}) {
  const t = THEME[theme];
  const { data } = useSWR<AttributionResponse>(apiPath, fetcher);
  const [granularity, setGranularity] = useState<AttributionGranularity>("week");
  const [periodKey, setPeriodKey] = useState<string | null>(null);

  const buckets = data ? data[granularity] : [];
  const selected =
    buckets.find((b) => b.key === periodKey) ?? buckets[0] ?? null;
  const status =
    selected && goal != null ? cellStatus(selected.rate ?? null, goal, "higher") : null;
  // Same formula, split by rep, for whichever period is selected.
  const { data: byRep } = useSWR<AttributionByRepResponse>(
    byRepPath && selected ? `${byRepPath}?start=${selected.start}&end=${selected.end}` : null,
    fetcher,
    { keepPreviousData: true }
  );

  return (
    <div className={t.card}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="mr-auto flex overflow-hidden rounded-md">
          {(["month", "week"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setGranularity(g);
                setPeriodKey(null);
              }}
              className={`px-3 py-1 text-xs font-semibold capitalize ${
                granularity === g ? t.toggleOn : t.toggleOff
              }`}
            >
              {g === "month" ? "Monthly" : "Weekly"}
            </button>
          ))}
        </div>
        <select
          className={t.control}
          value={selected?.key ?? ""}
          onChange={(e) => setPeriodKey(e.target.value)}
        >
          {buckets.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <div className={t.label}>Attribution Rate</div>
              {status ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: STATUS_DOT[status] }}
                  aria-label={`KPI status: ${status}`}
                />
              ) : null}
            </div>
            <div className={t.rate}>{formatStatValue(selected.rate, "percent")}</div>
            <div className={`mt-1 ${t.muted}`}>{brandLabel}</div>
            {goal !== undefined ? (
              <div className={`mt-1 ${t.muted}`}>
                {goal != null ? `≥ ${formatStatValue(goal, "percent")}` : "No goal set"}
              </div>
            ) : null}
          </div>
          <div>
            <div className={t.label}>Portal Purchases Tracked</div>
            <div className={`mt-2 ${t.value}`}>
              {formatStatValue(selected.portalPurchases, "number")}
            </div>
          </div>
          <div>
            <div className={t.label}>Purchases Logged (PCN)</div>
            <div className={`mt-2 ${t.value}`}>
              {formatStatValue(selected.pcnCloses, "number")}
            </div>
          </div>
        </div>
      ) : (
        <div className={t.muted}>No periods available yet.</div>
      )}

      {byRepPath && selected ? (
        <div className={`mt-5 border-t pt-4 ${t.divider}`}>
          <div className={t.label}>Attribution Rate By Rep</div>
          {!byRep ? (
            <div className={`mt-2 ${t.muted}`}>Loading...</div>
          ) : selected.end < byRep.trackingStart ? (
            <div className={`mt-2 ${t.muted}`}>
              The portal only started tagging sales with each rep&apos;s Shared ID on{" "}
              {byRep.trackingStart}, so this period can&apos;t be split by rep.
            </div>
          ) : byRep.reps.length === 0 ? (
            <div className={`mt-2 ${t.muted}`}>No purchases logged or tracked for a rep in this period.</div>
          ) : (
            <>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className={`border-b text-left ${t.divider} ${t.muted}`}>
                    <th className="py-2 pr-3 font-semibold uppercase tracking-wide">Rep</th>
                    <th className="py-2 pr-3 text-right font-semibold uppercase tracking-wide">
                      Attribution Rate
                    </th>
                    <th className="py-2 pr-3 text-right font-semibold uppercase tracking-wide">
                      Portal Tracked
                    </th>
                    <th className="py-2 text-right font-semibold uppercase tracking-wide">
                      Logged (PCN)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byRep.reps.map((r) => {
                    const repStatus =
                      goal != null && r.rate !== null ? cellStatus(r.rate, goal, "higher") : null;
                    return (
                      <tr key={r.rep} className={`border-b last:border-0 ${t.divider}`}>
                        <td className={`py-2 pr-3 font-medium ${t.value} text-sm`}>{r.rep}</td>
                        <td className={`py-2 pr-3 text-right ${t.value} text-sm`}>
                          <span className="inline-flex items-center justify-end gap-2">
                            {repStatus ? (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: STATUS_DOT[repStatus] }}
                                aria-label={`KPI status: ${repStatus}`}
                              />
                            ) : null}
                            {formatStatValue(r.rate, "percent")}
                          </span>
                        </td>
                        <td className={`py-2 pr-3 text-right ${t.value} text-sm`}>
                          {formatStatValue(r.tracked, "number")}
                        </td>
                        <td className={`py-2 text-right ${t.value} text-sm`}>
                          {formatStatValue(r.logged, "number")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className={`mt-2 ${t.muted}`}>
                Same formula per rep: portal sales under their Shared ID ÷ purchases they logged in
                Affiliate PCN.
                {byRep.countedFrom > selected.start
                  ? ` Counted from ${byRep.countedFrom}, the day the portal started tagging sales by rep, so these add up to less than the totals above.`
                  : ""}
                {byRep.unassigned > 0
                  ? ` ${byRep.unassigned} portal sale${byRep.unassigned === 1 ? "" : "s"} in this period had no Shared ID, so ${byRep.unassigned === 1 ? "it counts" : "they count"} for nobody here.`
                  : ""}
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className={`mt-3 ${t.muted}`}>
        Portal purchases {brandLabel.toLowerCase()} the affiliate network tracked, divided by
        purchases the team logged as closed in Affiliate PCN for {selected?.label ?? "the period"}.
        Ignores everything before Aug 2026; weekly view starts Sep 2026. Today is never counted:
        the portal takes up to 8 hours to show a sale, so the numbers run through yesterday.
      </div>
    </div>
  );
}
