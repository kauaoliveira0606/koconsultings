"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, X } from "lucide-react";
import { Markdown } from "@/components/berlin/Markdown";
import type { BrainDoc } from "@/lib/brain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const TEMPLATE = `## Why it works

## Structure (beat by beat)
1. Hook (0-3s):
2.
3.

## Template

## Example script

## Mistakes to avoid
- `;

/**
 * "Always on the newest trend": formats added over time (Skills & Knowledge, type Format).
 * The newest show first here and in Claude's list_ad_formats.
 */
export function NewFormats() {
  const { data, mutate } = useSWR<{ docs: BrainDoc[] }>("/api/bronson/brain", fetcher);
  const formats = (Array.isArray(data?.docs) ? data!.docs : []).filter((d) => d.type === "Format").sort((a, b) => b.updated.localeCompare(a.updated));
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<BrainDoc | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState(TEMPLATE);
  const [busy, setBusy] = useState(false);
  // "New" badge for formats added in the last 30 days (computed once, not on every render).
  const [monthAgo] = useState(() => new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));

  async function save() {
    setBusy(true);
    const r = await fetch("/api/bronson/brain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", type: "Format", category: "Ad format", title, summary, body }),
    });
    if (r.ok) {
      await mutate(await r.json(), false);
      setAdding(false);
      setTitle("");
      setSummary("");
      setBody(TEMPLATE);
    }
    setBusy(false);
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-strong)]">New formats</h2>
          <p className="text-[13px] text-[var(--text-muted)]">Spot a format that&rsquo;s working? Add it here and it lands in Claude right away (newest first).</p>
        </div>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white"><Plus size={15} /> Add a format</button>
      </div>

      {adding ? (
        <div className="mb-4 space-y-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--panel-bg)] p-4">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Format name" className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm" />
          <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One line: what it is and when to use it" className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 font-mono text-[13px]" />
          <div className="flex gap-2">
            <button disabled={busy || !title.trim()} onClick={save} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Saving…" : "Save format"}</button>
            <button onClick={() => setAdding(false)} className="px-2 text-sm text-[var(--text-muted)]">Cancel</button>
          </div>
        </div>
      ) : null}

      {formats.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {formats.map((f) => (
            <button key={f.id} onClick={() => setOpen(f)} className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-left hover:border-[var(--accent)]/50">
              <div className="flex items-center gap-2">
                {f.updated >= monthAgo ? <span className="rounded-full bg-[#db2777] px-2 py-0.5 text-[10px] font-bold uppercase text-white">New</span> : null}
                <span className="text-[11px] text-[var(--text-muted)]">Added {f.updated}</span>
              </div>
              <div className="mt-2 text-[15px] font-semibold text-[var(--text-strong)]">{f.title}</div>
              {f.summary ? <p className="mt-1 text-[13px] text-[var(--text-muted)]">{f.summary}</p> : null}
            </button>
          ))}
        </div>
      ) : data ? (
        <p className="rounded-lg border border-dashed border-[var(--panel-border)] px-4 py-5 text-center text-[13px] text-[var(--text-muted)]">No new formats yet. The core library is below.</p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setOpen(null)}>
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-[var(--panel-bg)] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between">
              <h2 className="text-2xl font-bold text-[var(--text-strong)]">{open.title}</h2>
              <button onClick={() => setOpen(null)} className="rounded-md border border-[var(--panel-border)] p-1.5" aria-label="Close"><X size={15} /></button>
            </div>
            {open.summary ? <p className="mb-4 text-[13px] text-[var(--text-muted)]">{open.summary}</p> : null}
            <Markdown source={open.body} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
