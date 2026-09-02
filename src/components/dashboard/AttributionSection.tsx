"use client";

import { useState } from "react";
import useSWR from "swr";
import { formatStatValue } from "@/lib/format";
import type { AttributionBucket, AttributionGranularity } from "@/lib/attribution";

type AttributionResponse = {
  brands: string[];
  month: AttributionBucket[];
  week: AttributionBucket[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
  },
} as const;

export function AttributionSection({
  apiPath,
  theme = "light",
  brandLabel,
}: {
  apiPath: string;
  theme?: "light" | "dark" | "deepspace";
  brandLabel: string;
}) {
  const t = THEME[theme];
  const { data } = useSWR<AttributionResponse>(apiPath, fetcher);
  const [granularity, setGranularity] = useState<AttributionGranularity>("week");
  const [periodKey, setPeriodKey] = useState<string | null>(null);

  const buckets = data ? data[granularity] : [];
  const selected =
    buckets.find((b) => b.key === periodKey) ?? buckets[0] ?? null;

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
            <div className={t.label}>Attribution Rate</div>
            <div className={t.rate}>{formatStatValue(selected.rate, "percent")}</div>
            <div className={`mt-1 ${t.muted}`}>{brandLabel}</div>
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

      <div className={`mt-3 ${t.muted}`}>
        Portal purchases {brandLabel.toLowerCase()} the affiliate network tracked, divided by
        purchases the team logged as closed in Affiliate PCN for {selected?.label ?? "the period"}.
        Ignores everything before Aug 2026; weekly view starts Sep 2026.
      </div>
    </div>
  );
}
