"use client";

import { useState } from "react";
import { useSharedRange } from "@/lib/range-context";
import { rangeToQuery, useSectionData } from "@/lib/use-section-data";
import { Panel } from "@/components/berlin/Berlin";
import { formatStatValue } from "@/lib/format";
import type { CreativeScore } from "@/lib/creative-score";
import { askAssistant } from "@/components/berlin/AskBerlin";

const VERDICT_STYLE: Record<CreativeScore["verdict"], React.CSSProperties> = {
  Scale: { background: "var(--cell-green-bg)", color: "var(--cell-green-text)" },
  "Fix the hook": { background: "var(--cell-yellow-bg)", color: "var(--cell-yellow-text)" },
  "Fix the body": { background: "var(--cell-yellow-bg)", color: "var(--cell-yellow-text)" },
  "Fix the CTA": { background: "var(--cell-yellow-bg)", color: "var(--cell-yellow-text)" },
  Kill: { background: "var(--cell-red-bg)", color: "var(--cell-red-text)" },
  "Not enough spend": { background: "var(--panel-subtle)", color: "var(--text-muted)" },
};

function Bar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[12px] text-[var(--text-muted)]">—</span>;
  const color = score >= 70 ? "#059669" : score >= 45 ? "#d97706" : "#e11d48";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-14 overflow-hidden rounded-full bg-[var(--panel-subtle)]">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="w-6 text-right text-[12px] font-semibold tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}

/** Creative scores: hook, body, CTA and result per ad, a verdict, what to test next, and a button to queue the next batch for the AI. */
export function CreativeScores() {
  const { range } = useSharedRange();
  const { data } = useSectionData<{ scores: CreativeScore[] }>("/api/bronson/ads/creative", range, 300_000);
  const [queued, setQueued] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scores = Array.isArray(data?.scores) ? data!.scores : [];

  async function queue() {
    setBusy(true);
    try {
      const res = await fetch(`/api/bronson/ads/creative?${rangeToQuery(range)}`, { method: "POST" });
      setQueued(res.ok ? "Queued in the Office AI queue." : "Couldn't queue it. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="mb-6 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-border)] px-5 py-4">
        <div>
          <div className="text-[15px] font-semibold text-[var(--text-strong)]">Creative scores</div>
          <div className="text-[12px] text-[var(--text-muted)]">Each ad scored piece by piece against your lines (80 = on the good line, 40 = on the bad line). Ads need $30+ spend to be judged.</div>
        </div>
        <div className="flex items-center gap-2">
          {queued ? <span className="text-[12px] text-[var(--text-muted)]">{queued}</span> : null}
          <button onClick={queue} disabled={busy || !scores.length} className="rounded-lg bg-[#7c3aed] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50">
            {busy ? "Queuing…" : "Queue next batch for AI"}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
              <th className="px-5 py-3 font-medium">Ad</th>
              <th className="px-3 py-3 font-medium">Score</th>
              <th className="px-3 py-3 font-medium">Hook</th>
              <th className="px-3 py-3 font-medium">Body</th>
              <th className="px-3 py-3 font-medium">CTA</th>
              <th className="px-3 py-3 font-medium">Result</th>
              <th className="px-3 py-3 text-right font-medium">Spent</th>
              <th className="px-3 py-3 text-right font-medium">Cost / reg.</th>
              <th className="px-5 py-3 font-medium">Verdict · test next</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={s.entityId} className="border-t border-[var(--panel-border)] align-top">
                <td className="max-w-[260px] px-5 py-3 font-medium text-[var(--text-strong)]"><div className="truncate" title={s.name}>{s.name}</div></td>
                <td className="px-3 py-3"><span className="text-[18px] font-bold tabular-nums text-[var(--text-strong)]">{s.score ?? "—"}</span></td>
                <td className="px-3 py-3"><Bar score={s.pieces.hook.score} /><div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{formatStatValue(s.pieces.hook.value, "percent")}</div></td>
                <td className="px-3 py-3"><Bar score={s.pieces.body.score} /><div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{formatStatValue(s.pieces.body.value, "percent")}</div></td>
                <td className="px-3 py-3"><Bar score={s.pieces.cta.score} /><div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{formatStatValue(s.pieces.cta.value, "percent")}</div></td>
                <td className="px-3 py-3"><Bar score={s.pieces.result.score} /></td>
                <td className="px-3 py-3 text-right tabular-nums">{formatStatValue(s.spend, "currency")}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatStatValue(s.costPerReg, "currency")}</td>
                <td className="max-w-[340px] px-5 py-3">
                  <span className="inline-block rounded-md px-2 py-0.5 text-[12px] font-bold" style={VERDICT_STYLE[s.verdict]}>{s.verdict}</span>
                  <div className="mt-1 text-[12px] leading-snug text-[var(--text-muted)]">{s.why} {s.testNext}</div>
                  <button
                    onClick={() => askAssistant(jeremyAdPrompt(s))}
                    className="mt-1.5 text-[12px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    Ask Jeremy about this ad
                  </button>
                </td>
              </tr>
            ))}
            {data && scores.length === 0 ? <tr><td colSpan={9} className="px-5 py-8 text-center text-[var(--text-muted)]">No ads with spend in this range.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** Question for Jeremy AI about one ad, with its scores and spend. */
function jeremyAdPrompt(s: CreativeScore): string {
  const spent = Math.round(s.spend);
  return [
    `Look at the ad "${s.name}" in Berlin (get_creative_scores and get_campaigns_and_ads).`,
    `Score ${s.score}, verdict ${s.verdict}; hook ${s.pieces.hook.score}, body ${s.pieces.body.score}, CTA ${s.pieces.cta.score}; ${spent} dollars spent, ${s.registrations} registrations.`,
    "What exactly should I change? Write me the new version.",
  ].join(" ");
}
