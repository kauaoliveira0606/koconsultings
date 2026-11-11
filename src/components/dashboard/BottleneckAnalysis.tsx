"use client";

import { useState } from "react";
import useSWR from "swr";
import { Sparkles, RefreshCw } from "lucide-react";
import { Markdown } from "@/components/berlin/Markdown";
import type { BottleneckReport } from "@/lib/bottlenecks";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** AI read of the scorecard: the 1-3 stages limiting cash, lead quality, and pace. No ad-level calls. */
export function BottleneckAnalysis() {
  const { data, mutate } = useSWR<{ report: BottleneckReport | null }>("/api/bronson/scorecard-ai", fetcher);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const report = data?.report ?? null;

  async function rerun() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/bronson/scorecard-ai", { method: "POST" });
      const j = await r.json();
      if (r.ok) await mutate(j, false);
      else setError(j.error ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  const when = report ? new Date(report.created).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
          <Sparkles size={14} /> {report ? `Updated ${when} ET · refreshes every morning` : "Reads this week's scorecard, pacing and lead quality"}
        </div>
        <button onClick={rerun} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50">
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> {busy ? "Analyzing… (about 30 seconds)" : report ? "Refresh analysis" : "Run analysis"}
        </button>
      </div>
      {error ? <p className="mb-2 text-sm text-rose-600">{error}</p> : null}
      {report ? <Markdown source={report.text} /> : data ? <p className="text-sm text-[var(--text-muted)]">No analysis yet. Run it to see what&rsquo;s holding the business back this week.</p> : <p className="text-sm text-[var(--text-muted)]">Loading…</p>}
    </div>
  );
}
