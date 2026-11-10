"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Plus, Pencil, Trash2, X, Search } from "lucide-react";
import { BerlinHeader } from "@/components/berlin/Berlin";
import { Markdown } from "@/components/berlin/Markdown";
import type { BrainDoc, BrainType } from "@/lib/brain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const TYPES: BrainType[] = ["Skill", "SOP", "Rules", "Process", "Note"];
const TYPE_LABEL: Record<BrainType, string> = { Skill: "Skills", SOP: "SOPs", Rules: "Rules", Process: "Processes", Note: "Notes" };
const TYPE_COLOR: Record<BrainType, string> = { Skill: "#7c3aed", SOP: "#2563eb", Rules: "#e11d48", Process: "#059669", Note: "#64748b" };
const input =
  "w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--accent)]";

/** Skills & Knowledge: the library Claude and the team start from. Search, read, add and edit. */
export function BrainBoard() {
  const { data, mutate } = useSWR<{ docs: BrainDoc[] }>("/api/bronson/brain", fetcher);
  const docs = useMemo(() => (Array.isArray(data?.docs) ? data!.docs : []), [data]);
  const [type, setType] = useState<BrainType | "All">("All");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BrainDoc | "new" | null>(null);
  const [error, setError] = useState("");

  const query = q.trim().toLowerCase();
  const shown = docs.filter(
    (d) =>
      (type === "All" || d.type === type) &&
      (!query || d.title.toLowerCase().includes(query) || d.summary.toLowerCase().includes(query) || d.body.toLowerCase().includes(query)),
  );
  const open = docs.find((d) => d.id === openId) ?? null;

  async function post(payload: Record<string, unknown>) {
    setError("");
    const res = await fetch("/api/bronson/brain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Save failed");
      return false;
    }
    await mutate(json, false);
    return true;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <BerlinHeader
          title="Skills & Knowledge"
          subtitle="Every Claude skill, SOP, rules doc and process in one place. Claude searches this through the Berlin connector before it starts a task, so the work starts from what already works."
        />
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3.5 py-2 text-sm font-semibold text-white">
          <Plus size={15} /> Add document
        </button>
      </div>
      {error ? <p className="mb-4 rounded-md bg-[var(--cell-red-bg)] px-3 py-2 text-sm text-[var(--cell-red-text)]">{error}</p> : null}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-0.5">
          {(["All", ...TYPES] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-semibold ${type === t ? "bg-black text-white" : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"}`}
            >
              {t === "All" ? `All (${docs.length})` : `${TYPE_LABEL[t]} (${docs.filter((d) => d.type === t).length})`}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search everything" className="w-64 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]" />
        </div>
      </div>

      {!data ? <p className="text-sm text-[var(--text-muted)]">Loading…</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((d) => (
          <button
            key={d.id}
            onClick={() => setOpenId(d.id)}
            className="flex flex-col rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-left transition-colors hover:border-[var(--accent)]/50"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: TYPE_COLOR[d.type] }}>{d.type}</span>
              {d.category ? <span className="text-[11px] text-[var(--text-muted)]">{d.category}</span> : null}
            </div>
            <div className="mt-2 text-[15px] font-semibold leading-snug text-[var(--text-strong)]">{d.title}</div>
            {d.summary ? <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-[var(--text-muted)]">{d.summary}</p> : null}
            <div className="mt-auto pt-3 text-[11px] text-[var(--text-muted)]">{d.source}{d.updated ? ` · ${d.updated}` : ""}</div>
          </button>
        ))}
        {data && shown.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Nothing matches.</p> : null}
      </div>

      {/* Reader */}
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setOpenId(null)}>
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-[var(--panel-bg)] p-6 shadow-2xl sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: TYPE_COLOR[open.type] }}>{open.type}</span>
                <h2 className="mt-2 text-2xl font-bold text-[var(--text-strong)]">{open.title}</h2>
                <div className="mt-1 text-[12px] text-[var(--text-muted)]">{open.category}{open.source ? ` · ${open.source}` : ""}{open.updated ? ` · updated ${open.updated}` : ""}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => { setEditing(open); setOpenId(null); }} className="inline-flex items-center gap-1 rounded-md border border-[var(--panel-border)] px-2.5 py-1.5 text-[12px] font-semibold"><Pencil size={13} /> Edit</button>
                <button onClick={() => setOpenId(null)} className="rounded-md border border-[var(--panel-border)] p-1.5" aria-label="Close"><X size={15} /></button>
              </div>
            </div>
            {open.summary ? <p className="mb-4 rounded-lg bg-[var(--panel-subtle)] p-3 text-[13px] text-[var(--text-muted)]">{open.summary}</p> : null}
            <Markdown source={open.body} />
          </div>
        </div>
      ) : null}

      {/* Editor */}
      {editing ? (
        <Editor
          doc={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDelete={editing !== "new" ? async () => { if (await post({ action: "delete", id: editing.id })) setEditing(null); } : undefined}
          onSave={async (f) => {
            const ok = editing === "new" ? await post({ action: "add", ...f }) : await post({ action: "update", id: editing.id, ...f });
            if (ok) setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Editor({ doc, onSave, onClose, onDelete }: {
  doc: BrainDoc | null;
  onSave: (f: { title: string; type: BrainType; category: string; summary: string; body: string }) => Promise<void>;
  onClose: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(doc?.title ?? "");
  const [type, setType] = useState<BrainType>(doc?.type ?? "SOP");
  const [category, setCategory] = useState(doc?.category ?? "");
  const [summary, setSummary] = useState(doc?.summary ?? "");
  const [body, setBody] = useState(doc?.body ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div className="my-4 w-full max-w-3xl rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-strong)]">{doc ? "Edit document" : "Add document"}</h2>
          <button onClick={onClose} className="rounded-md border border-[var(--panel-border)] p-1.5" aria-label="Close"><X size={15} /></button>
        </div>
        <div className="space-y-2.5">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={input} />
          <div className="flex gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as BrainType)} className={input}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (e.g. Ads, Webinars, Sales)" className={input} />
          </div>
          <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One-line summary (helps search)" className={input} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={18} placeholder="Paste the SOP, skill or notes here. Markdown works: # headings, - lists, **bold**." className={`${input} font-mono text-[13px] leading-relaxed`} />
          <div className="flex items-center gap-2">
            <button
              disabled={busy || !title.trim() || !body.trim()}
              onClick={async () => { setBusy(true); await onSave({ title: title.trim(), type, category: category.trim(), summary: summary.trim(), body }); setBusy(false); }}
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button onClick={onClose} className="px-2 text-sm text-[var(--text-muted)]">Cancel</button>
            {onDelete ? <button onClick={onDelete} className="ml-auto inline-flex items-center gap-1 text-sm text-rose-600"><Trash2 size={14} /> Delete</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
