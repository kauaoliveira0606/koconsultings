"use client";

import { useState } from "react";
import { Copy, Check, ShieldCheck } from "lucide-react";
import { BerlinHeader, Panel } from "@/components/berlin/Berlin";
import type { CopyCheckResult, Issue } from "@/lib/copy-check";

const KINDS = ["Ad script", "Ad caption", "YouTube script", "VSL", "Landing page", "Email", "SMS", "Setter / closer script", "Other"];
const VERDICT: Record<CopyCheckResult["verdict"], { label: string; style: React.CSSProperties }> = {
  ship: { label: "Ready to ship", style: { background: "var(--cell-green-bg)", color: "var(--cell-green-text)" } },
  fix: { label: "Fix before shipping", style: { background: "var(--cell-yellow-bg)", color: "var(--cell-yellow-text)" } },
  block: { label: "Blocked", style: { background: "var(--cell-red-bg)", color: "var(--cell-red-text)" } },
};
const SEV: Record<Issue["severity"], string> = { block: "#e11d48", fix: "#d97706", note: "#64748b" };

function IssueList({ title, issues }: { title: string; issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <div className="mt-5">
      <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{title}</div>
      <ul className="space-y-2.5">
        {issues.map((i, k) => (
          <li key={k} className="rounded-lg border border-[var(--panel-border)] p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: SEV[i.severity] }} />
              <span className="text-[13px] font-semibold text-[var(--text-strong)]">{i.rule}</span>
              <span className="text-[11px] uppercase text-[var(--text-muted)]">{i.severity}</span>
            </div>
            <div className="mt-1.5 rounded bg-[var(--panel-subtle)] px-2 py-1 text-[13px] italic text-[var(--text)]">&ldquo;{i.quote}&rdquo;</div>
            <div className="mt-1.5 text-[13px] text-[var(--text-muted)]">{i.fix}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Paste copy, get a ship / fix / block verdict, every broken rule quoted, and a fixed version. */
export function CopyCheckBoard() {
  const [text, setText] = useState("");
  const [kind, setKind] = useState(KINDS[0]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<CopyCheckResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function run() {
    setBusy(true);
    setError("");
    setRes(null);
    try {
      const r = await fetch("/api/bronson/copy-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, kind }) });
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "Check failed");
      else setRes(j);
    } catch {
      setError("Check failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <BerlinHeader
        title="Copy check"
        subtitle="Nothing ships until it passes. Paste an ad, script, page or email: it's scanned for banned words and checked against the Bronson rules and the ad creative framework in Skills & Knowledge."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2.5 py-2 text-sm">
              {KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
            <span className="text-[12px] text-[var(--text-muted)]">{text.length ? `${text.split(/\s+/).filter(Boolean).length} words` : ""}</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={20}
            placeholder="Paste the copy here…"
            className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-[var(--accent)]"
          />
          <button onClick={run} disabled={busy || !text.trim()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            <ShieldCheck size={16} /> {busy ? "Checking… (about 20-40 seconds)" : "Check copy"}
          </button>
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        </Panel>

        <Panel>
          {!res ? (
            <p className="text-sm text-[var(--text-muted)]">The verdict, every problem with the exact words, and a fixed version show up here.</p>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg px-3 py-1.5 text-[15px] font-bold" style={VERDICT[res.verdict].style}>{VERDICT[res.verdict].label}</span>
                <span className="text-[22px] font-bold text-[var(--text-strong)]">{res.score}<span className="text-[13px] font-normal text-[var(--text-muted)]">/100</span></span>
                <span className="text-[12px] text-[var(--text-muted)]">Reviewed by {res.reviewedBy === "claude + jeremy ai" ? "rules + Claude + Jeremy AI" : res.reviewedBy === "claude" ? "rules + Claude" : "rule scan only"}</span>
              </div>
              <p className="mt-3 text-[14px] text-[var(--text)]">{res.summary}</p>
              <IssueList title="Rule scan" issues={res.ruleHits} />
              <IssueList title="Review" issues={res.issues} />
              {res.rewrite ? (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[13px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Fixed version</div>
                    <button
                      onClick={async () => { try { await navigator.clipboard.writeText(res.rewrite); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ } }}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--panel-border)] px-2 py-1 text-[12px] font-semibold"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap rounded-lg bg-[var(--panel-subtle)] p-3 font-sans text-[14px] leading-relaxed text-[var(--text-strong)]">{res.rewrite}</pre>
                </div>
              ) : null}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
