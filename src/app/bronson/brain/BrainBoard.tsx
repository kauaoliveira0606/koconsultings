"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Plus, Pencil, Trash2, X, Search, BookOpen, Target, Sparkles } from "lucide-react";
import { BerlinHeader } from "@/components/berlin/Berlin";
import { Markdown } from "@/components/berlin/Markdown";
import type { BrainDoc, BrainType } from "@/lib/brain";

const isAgent = (d: BrainDoc) => d.category === "Agents" || d.title.startsWith("Agent:");

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const TYPES: BrainType[] = ["Skill", "SOP", "Rules", "Process", "Format", "Note"];
const TYPE_LABEL: Record<BrainType, string> = { Skill: "Skills", SOP: "SOPs", Rules: "Rules", Process: "Processes", Format: "Ad formats", Note: "Knowledge" };
const TYPE_COLOR: Record<BrainType, string> = { Skill: "#7c3aed", SOP: "#2563eb", Rules: "#e11d48", Process: "#059669", Format: "#db2777", Note: "#64748b" };
const input =
  "w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--accent)]";
type Metric = { tag: string; label: string };
type AreaInfo = { id: string; label: string; about: string; pillar: string; feedback: boolean };
type PillarInfo = { id: string; label: string; about: string };
type AreaFeedback = { id: string; area: string; date: string; created: string; text: string };

/** Where Berlin puts each kind of doc to work. */
function usedIn(d: BrainDoc): string[] {
  const out = ["Ask Berlin and Ask Jeremy (when a question matches)", "AI worker (looks up the SOP before every task)"];
  if (d.covers.length) out.unshift(`Bottleneck analysis, daily feedback and alerts, whenever ${d.covers.slice(0, 3).join(", ")} is off target`);
  if (d.type === "Rules") out.unshift("Copy check and every piece of copy the AI writes");
  if (d.type === "Format") out.unshift("Ad formats tab and new ad batches");
  return out;
}

/**
 * Skill breakdown (user, 2026-11-11: "a full breakdown of what it is" for every
 * skill). Stored at the top of the body between <!-- breakdown --> markers, one
 * "### Heading" per part; the full skill file follows it.
 */
function parseBreakdown(body: string): { parts: { h: string; text: string }[]; rest: string } {
  const m = body.match(/<!-- breakdown -->([\s\S]*?)<!-- \/breakdown -->/);
  if (!m) return { parts: [], rest: body };
  const parts = m[1]
    .split(/^### /m)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const nl = c.indexOf("\n");
      return nl < 0 ? { h: c, text: "" } : { h: c.slice(0, nl).trim(), text: c.slice(nl + 1).trim() };
    });
  return { parts, rest: body.replace(m[0], "").trim() };
}

function words(n: string) {
  return n.split(/\s+/).filter(Boolean).length;
}

/** Skills and SOPs: every skill, SOP, rule and piece of knowledge Berlin is trained on, card by card. */
export function BrainBoard() {
  const { data, mutate } = useSWR<{ docs: BrainDoc[]; metrics: Metric[]; areas: AreaInfo[]; pillars: PillarInfo[] }>("/api/bronson/brain", fetcher);
  const { data: fb, mutate: mutateFb } = useSWR<{ latest: Record<string, AreaFeedback> }>("/api/bronson/area-feedback", fetcher);
  const areas = data?.areas ?? [];
  const [area, setArea] = useState<string>("all");
  const pillars = data?.pillars ?? [];
  const [pillar, setPillar] = useState<string>("all");
  // Skills (things Claude runs) vs Knowledge base (SOPs, trainings, rules, notes): user, 2026-11-11.
  const [lib, setLib] = useState<"skills" | "kb">("kb");
  const inLib = (d: BrainDoc, l: "skills" | "kb") => (l === "skills" ? d.type === "Skill" : d.type !== "Skill");
  const pillarAreas = (p: string) => areas.filter((a) => a.pillar === p).map((a) => a.id);
  const inPillar = (d: BrainDoc, p: string) => p === "all" || d.sections.some((s) => pillarAreas(p).includes(s));
  const docs = useMemo(() => (Array.isArray(data?.docs) ? data!.docs : []), [data]);
  const metrics = data?.metrics ?? [];
  const [type, setType] = useState<BrainType | "All">("All");
  const [q, setQ] = useState("");
  const [metric, setMetric] = useState<string | null>(null);
  // Deep link from alerts / feedback: /bronson/brain?doc=<id>
  const params = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(() => params.get("doc"));
  const [editing, setEditing] = useState<BrainDoc | "new" | null>(null);
  const [error, setError] = useState("");
  // Bulk delete: tick cards, then Delete.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  async function deleteSelected() {
    setDeleting(true);
    if (await post({ action: "deleteMany", ids: [...selected] })) setSelected(new Set());
    setConfirmBulk(false);
    setDeleting(false);
  }

  const query = q.trim().toLowerCase();
  // The list has no bodies (they load per doc), so full-text matches come from the server.
  const { data: bodyHits } = useSWR<{ ids: string[] }>(query.length >= 3 ? `/api/bronson/brain?contains=${encodeURIComponent(query)}` : null, fetcher, { keepPreviousData: true });
  const hitIds = useMemo(() => new Set(bodyHits?.ids ?? []), [bodyHits]);
  const shown = docs.filter(
    (d) =>
      inLib(d, lib) &&
      inPillar(d, pillar) &&
      (area === "all" || d.sections.includes(area)) &&
      (type === "All" || d.type === type) &&
      (!metric || d.covers.includes(metric)) &&
      (!query || d.title.toLowerCase().includes(query) || d.summary.toLowerCase().includes(query) || hitIds.has(d.id)),
  );
  const open = docs.find((d) => d.id === openId) ?? null;
  const { data: full, mutate: mutateFull } = useSWR<{ doc: BrainDoc }>(openId ? `/api/bronson/brain?id=${openId}` : null, fetcher);
  const openFull = full?.doc && full.doc.id === openId ? full.doc : null;
  const coverage = metrics.map((m) => {
    const all = docs.filter((d) => d.type !== "Rules" && d.type !== "Note" && d.covers.includes(m.tag));
    const real = all.filter((d) => !isAgent(d));
    return { ...m, docs: all, real };
  });

  async function post(payload: Record<string, unknown>) {
    setError("");
    const res = await fetch("/api/bronson/brain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Save failed");
      return false;
    }
    await mutate({ ...json, metrics, areas, pillars }, false);
    if (openId) await mutateFull();
    return true;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <BerlinHeader
          title="Skills and SOPs"
          subtitle="Everything Berlin is trained on. Feedback, the bottleneck analysis, alerts, the AI worker and Ask Jeremy pull from these, and each one keeps growing as you add to it."
        />
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3.5 py-2 text-sm font-semibold text-white">
          <Plus size={15} /> New skill or SOP
        </button>
      </div>
      {error ? <p className="mb-4 rounded-md bg-[var(--cell-red-bg)] px-3 py-2 text-sm text-[var(--cell-red-text)]">{error}</p> : null}

      {/* Library: Skills vs Knowledge base */}
      <div className="mb-4 inline-flex rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-1">
        {([["kb", "Knowledge base"], ["skills", "Skills"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => { setLib(id); setType("All"); }}
            className={`rounded-lg px-4 py-2 text-[15px] font-bold ${lib === id ? "bg-black text-white" : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"}`}
          >
            {label} ({docs.filter((d) => inLib(d, id)).length})
          </button>
        ))}
      </div>
      <p className="mb-4 text-[13px] text-[var(--text-muted)]">
        {lib === "skills"
          ? "Skills are tools Claude runs to do a job (write copy, review a webinar, build a BID). Open one for the full breakdown: what it does, when to use it, what to give it and what you get back."
          : "The knowledge base is what we know: SOPs, course lessons and call transcripts, rules and notes. Skills and Berlin look things up here."}
      </p>

      {/* Top level: offer creation, fulfillment, sales; then the areas inside it */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {[{ id: "all", label: `Everything (${docs.filter((d) => inLib(d, lib)).length})` }, ...pillars.map((p) => ({ id: p.id, label: `${p.label} (${docs.filter((d) => inLib(d, lib) && inPillar(d, p.id)).length})` }))].map((p) => (
          <button
            key={p.id}
            onClick={() => { setPillar(p.id); setArea("all"); }}
            className={`rounded-lg px-3.5 py-2 text-[14px] font-bold ${pillar === p.id ? "bg-black text-white" : "border border-[var(--panel-border)] text-[var(--text-strong)] hover:bg-[var(--panel-subtle)]"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {pillar !== "all" ? <p className="mb-2 text-[13px] text-[var(--text-muted)]">{pillars.find((p) => p.id === pillar)?.about}</p> : null}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {[{ id: "all", label: pillar === "all" ? "All areas" : `All ${pillars.find((p) => p.id === pillar)?.label ?? ""}` }, ...areas.filter((a) => pillar === "all" || a.pillar === pillar).map((a) => ({ id: a.id, label: `${a.label} (${docs.filter((d) => inLib(d, lib) && d.sections.includes(a.id)).length})` }))].map((a) => (
          <button
            key={a.id}
            onClick={() => setArea(a.id)}
            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${area === a.id ? "bg-black text-white" : "border border-[var(--panel-border)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {area !== "all" && areas.find((a) => a.id === area)?.feedback ? (
        <JeremyAreaPanel area={areas.find((a) => a.id === area)!} feedback={fb?.latest?.[area] ?? null} onNew={(f) => mutateFb({ latest: { ...(fb?.latest ?? {}), [f.area]: f } }, false)} />
      ) : area !== "all" ? (
        <p className="mb-6 text-[13px] text-[var(--text-muted)]">{areas.find((a) => a.id === area)?.about}</p>
      ) : null}

      {/* Coverage: which metrics have an SOP behind them */}
      <section className="mb-8 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
        <div className="mb-1 flex items-center gap-2 text-[15px] font-bold text-[var(--text-strong)]"><Target size={16} /> Coverage</div>
        <p className="mb-3 text-[13px] text-[var(--text-muted)]">
          When one of these is off target, feedback and alerts cite the SOP behind it. Green has a real SOP, yellow only has a general AI agent, red has nothing. Add an SOP (or tag one) and it&rsquo;s used from then on.
        </p>
        <div className="flex flex-wrap gap-2">
          {coverage.map((m) => (
            <button
              key={m.tag}
              onClick={() => setMetric(metric === m.tag ? null : m.tag)}
              className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${metric === m.tag ? "ring-2 ring-[var(--accent)]" : ""}`}
              style={
                m.real.length
                  ? { background: "var(--cell-green-bg)", color: "var(--cell-green-text)", borderColor: "transparent" }
                  : m.docs.length
                    ? { background: "var(--cell-yellow-bg)", color: "var(--cell-yellow-text)", borderColor: "transparent" }
                    : { background: "var(--cell-red-bg)", color: "var(--cell-red-text)", borderColor: "transparent" }
              }
              title={m.docs.length ? m.docs.map((d) => d.title).join("\n") : "No SOP yet"}
            >
              {m.label} · {m.real.length ? `${m.real.length} SOP${m.real.length === 1 ? "" : "s"}` : m.docs.length ? "agent only" : "no SOP"}
            </button>
          ))}
        </div>
        {metric ? <p className="mt-2 text-[12px] text-[var(--text-muted)]">Showing docs that fix {metric}. Click it again to clear.</p> : null}
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className={`flex flex-wrap rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-0.5 ${lib === "skills" ? "hidden" : ""}`}>
          {(["All", ...TYPES.filter((t) => t !== "Skill")] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-semibold ${type === t ? "bg-black text-white" : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"}`}
            >
              {t === "All" ? `All (${docs.filter((d) => inLib(d, "kb")).length})` : `${TYPE_LABEL[t]} (${docs.filter((d) => d.type === t).length})`}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search everything" className="w-64 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]" />
        </div>
      </div>

      {!data ? <p className="text-sm text-[var(--text-muted)]">Loading…</p> : null}

      {/* Bulk actions */}
      <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-3 bg-[var(--app-bg)] py-2">
        <label className="flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={shown.length > 0 && shown.every((d) => selected.has(d.id))}
            onChange={(e) => setSelected(e.target.checked ? new Set([...selected, ...shown.map((d) => d.id)]) : new Set([...selected].filter((id) => !shown.some((d) => d.id === id))))}
          />
          Select all shown ({shown.length})
        </label>
        {selected.size ? (
          confirmBulk ? (
            <span className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-rose-600">Delete {selected.size} for good?</span>
              <button onClick={deleteSelected} disabled={deleting} className="rounded-md bg-rose-600 px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50">{deleting ? "Deleting…" : "Yes, delete"}</button>
              <button onClick={() => setConfirmBulk(false)} className="px-1 text-[13px] text-[var(--text-muted)]">Cancel</button>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <button onClick={() => setConfirmBulk(true)} className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-[13px] font-semibold text-white"><Trash2 size={14} /> Delete ({selected.size})</button>
              <button onClick={() => setSelected(new Set())} className="px-1 text-[13px] text-[var(--text-muted)]">Clear</button>
            </span>
          )
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((d) => (
          <div
            key={d.id}
            role="button"
            tabIndex={0}
            onClick={() => setOpenId(d.id)}
            onKeyDown={(e) => { if (e.key === "Enter") setOpenId(d.id); }}
            className={`relative flex cursor-pointer flex-col rounded-xl border bg-[var(--panel-bg)] p-4 pr-10 text-left transition-colors hover:border-[var(--accent)]/50 ${selected.has(d.id) ? "border-rose-500 ring-1 ring-rose-500" : "border-[var(--panel-border)]"}`}
          >
            <input
              type="checkbox"
              aria-label={`Select ${d.title}`}
              checked={selected.has(d.id)}
              onClick={(e) => e.stopPropagation()}
              onChange={() => toggleSelect(d.id)}
              className="absolute right-3 top-3 h-4 w-4 cursor-pointer"
            />
            <div className="flex items-center gap-2">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: TYPE_COLOR[d.type] }}>{d.type}</span>
              {d.category ? <span className="truncate text-[11px] text-[var(--text-muted)]">{d.category}</span> : null}
            </div>
            <div className="mt-2 text-[15px] font-semibold leading-snug text-[var(--text-strong)]">{d.title}</div>
            {d.summary ? <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-[var(--text-muted)]">{d.summary}</p> : null}
            {d.type === "Skill" ? (() => {
              const use = d.useWhen;
              return use != null ? (
                <p className="mt-2 line-clamp-3 rounded-md bg-[var(--panel-subtle)] px-2 py-1.5 text-[12px] leading-snug text-[var(--text-strong)]"><b>Use it when:</b> {use}</p>
              ) : (
                <p className="mt-2 text-[11px] font-semibold text-amber-600">No breakdown yet</p>
              );
            })() : null}
            {d.covers.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {d.covers.slice(0, 5).map((c) => <span key={c} className="rounded bg-[var(--panel-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-strong)]">fixes {c}</span>)}
              </div>
            ) : null}
            <div className="mt-auto pt-3 text-[11px] text-[var(--text-muted)]">
              {(d.words ?? words(d.body)).toLocaleString()} words · learns from {d.learnsFrom.split("\n")[0] || d.source || "Berlin"}
            </div>
          </div>
        ))}
        {data && shown.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Nothing matches.</p> : null}
      </div>

      {open ? (
        <Reader
          doc={openFull ?? open}
          loading={!openFull}
          metrics={metrics}
          areas={areas}
          onDelete={async () => { if (await post({ action: "delete", id: open.id })) setOpenId(null); }}
          onClose={() => setOpenId(null)}
          onEdit={() => { if (!openFull) return; setEditing(openFull); setOpenId(null); }}
          post={post}
        />
      ) : null}

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

function Reader({ doc, loading, metrics, areas, onClose, onEdit, onDelete, post }: { doc: BrainDoc; loading: boolean; metrics: Metric[]; areas: AreaInfo[]; onClose: () => void; onEdit: () => void; onDelete: () => Promise<void>; post: (p: Record<string, unknown>) => Promise<boolean> }) {
  const [sections, setSections] = useState<string[]>(doc.sections);
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function toggleSection(id: string) {
    const next = sections.includes(id) ? sections.filter((x) => x !== id) : [...sections, id];
    if (!next.length) return;
    setSections(next);
    await post({ action: "update", id: doc.id, sections: next });
  }
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [covers, setCovers] = useState<string[]>(doc.covers);
  const breakdown = parseBreakdown(doc.body);

  async function toggleCover(tag: string) {
    const next = covers.includes(tag) ? covers.filter((c) => c !== tag) : [...covers, tag];
    setCovers(next);
    await post({ action: "update", id: doc.id, covers: next });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-[var(--panel-bg)] p-6 shadow-2xl sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: TYPE_COLOR[doc.type] }}>{doc.type}</span>
            <h2 className="mt-2 text-2xl font-bold text-[var(--text-strong)]">{doc.title}</h2>
            <div className="mt-1 text-[12px] text-[var(--text-muted)]">{doc.category}{doc.updated ? ` · updated ${doc.updated}` : ""} · {(loading ? doc.words ?? 0 : words(doc.body)).toLocaleString()} words</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-[12px] text-rose-600">Delete for good?</span>
                <button onClick={onDelete} className="rounded-md bg-rose-600 px-2.5 py-1.5 text-[12px] font-semibold text-white">Yes, delete</button>
                <button onClick={() => setConfirmDelete(false)} className="px-1 text-[12px] text-[var(--text-muted)]">Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1 rounded-md border border-[var(--panel-border)] px-2.5 py-1.5 text-[12px] font-semibold text-rose-600"><Trash2 size={13} /> Delete</button>
            )}
            <button onClick={onEdit} disabled={loading} className="inline-flex items-center gap-1 rounded-md border border-[var(--panel-border)] px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-40"><Pencil size={13} /> Edit</button>
            <button onClick={onClose} className="rounded-md border border-[var(--panel-border)] p-1.5" aria-label="Close"><X size={15} /></button>
          </div>
        </div>

        {doc.type === "Skill" ? (
          breakdown.parts.length ? (
            <section className="mb-6">
              <div className="mb-2 flex items-center gap-2 text-[15px] font-bold text-[var(--text-strong)]"><Sparkles size={16} /> Skill breakdown</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {breakdown.parts.map((p) => (
                  <div key={p.h} className={`rounded-lg border border-[var(--panel-border)] p-3 ${p.text.length > 280 ? "sm:col-span-2" : ""}`}>
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#7c3aed]">{p.h}</div>
                    <div className="text-[13px] text-[var(--text-strong)]"><Markdown source={p.text} /></div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <p className="mb-6 rounded-lg bg-[var(--cell-yellow-bg)] px-3 py-2 text-[13px] text-[var(--cell-yellow-text)]">No breakdown yet. Ask Claude to write the breakdown for this skill.</p>
          )
        ) : null}

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-[var(--panel-subtle)] p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-[var(--text-muted)]"><BookOpen size={12} /> What it is</div>
            <p className="text-[13px] text-[var(--text-strong)]">{doc.summary || "No summary yet."}</p>
          </div>
          <div className="rounded-lg bg-[var(--panel-subtle)] p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-[var(--text-muted)]"><Sparkles size={12} /> Learns from</div>
            <ul className="space-y-0.5 text-[13px] text-[var(--text-strong)]">
              {(doc.learnsFrom || doc.source || "Added in Berlin").split("\n").map((l) => <li key={l}>{l}</li>)}
            </ul>
          </div>
          <div className="rounded-lg bg-[var(--panel-subtle)] p-3 sm:col-span-2">
            <div className="mb-1 text-[11px] font-bold uppercase text-[var(--text-muted)]">Used in</div>
            <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-[var(--text-strong)]">{usedIn({ ...doc, covers }).map((u) => <li key={u}>{u}</li>)}</ul>
          </div>
          <div className="rounded-lg bg-[var(--panel-subtle)] p-3 sm:col-span-2">
            <div className="mb-1.5 text-[11px] font-bold uppercase text-[var(--text-muted)]">Sections (click to move it)</div>
            <div className="flex flex-wrap gap-1.5">
              {areas.map((a) => (
                <button key={a.id} onClick={() => toggleSection(a.id)} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sections.includes(a.id) ? "bg-black text-white" : "border border-[var(--panel-border)] text-[var(--text-muted)]"}`}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          {doc.type !== "Rules" && doc.type !== "Note" ? (
            <div className="rounded-lg bg-[var(--panel-subtle)] p-3 sm:col-span-2">
              <div className="mb-1.5 text-[11px] font-bold uppercase text-[var(--text-muted)]">Fixes these metrics (click to tag)</div>
              <div className="flex flex-wrap gap-1.5">
                {metrics.map((m) => (
                  <button key={m.tag} onClick={() => toggleCover(m.tag)} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${covers.includes(m.tag) ? "bg-black text-white" : "border border-[var(--panel-border)] text-[var(--text-muted)]"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Keep building it */}
        <div className="mb-6 rounded-lg border border-dashed border-[var(--panel-border)] p-3">
          {adding ? (
            <div className="space-y-2">
              <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Paste new knowledge: notes from a training, a call, a fix that worked, a new rule…" className={input} />
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Where it's from (e.g. Jeremy Haynes mastermind, Nov 12 call)" className={input} />
              <div className="flex gap-2">
                <button disabled={busy || !text.trim()} onClick={async () => { setBusy(true); if (await post({ action: "append", id: doc.id, text, source })) { setAdding(false); setText(""); setSource(""); } setBusy(false); }} className="rounded-md bg-black px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40">{busy ? "Adding…" : "Add to this"}</button>
                <button onClick={() => setAdding(false)} className="px-2 text-[12px] text-[var(--text-muted)]">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--accent)]"><Plus size={14} /> Add knowledge to this {doc.type === "Skill" ? "skill" : doc.type === "SOP" ? "SOP" : "doc"}</button>
          )}
        </div>

        {doc.type === "Skill" && breakdown.parts.length ? <div className="mb-2 text-[11px] font-bold uppercase text-[var(--text-muted)]">Full skill file</div> : null}
        {loading ? <p className="text-sm text-[var(--text-muted)]">Loading the full document…</p> : <Markdown source={doc.type === "Skill" ? breakdown.rest : doc.body} />}
      </div>
    </div>
  );
}

function Editor({ doc, onSave, onClose, onDelete }: {
  doc: BrainDoc | null;
  onSave: (f: { title: string; type: BrainType; category: string; summary: string; body: string; learnsFrom: string }) => Promise<void>;
  onClose: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(doc?.title ?? "");
  const [type, setType] = useState<BrainType>(doc?.type ?? "SOP");
  const [category, setCategory] = useState(doc?.category ?? "");
  const [summary, setSummary] = useState(doc?.summary ?? "");
  const [learnsFrom, setLearnsFrom] = useState(doc?.learnsFrom ?? "");
  const [body, setBody] = useState(doc?.body ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div className="my-4 w-full max-w-3xl rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-strong)]">{doc ? "Edit" : "New skill or SOP"}</h2>
          <button onClick={onClose} className="rounded-md border border-[var(--panel-border)] p-1.5" aria-label="Close"><X size={15} /></button>
        </div>
        <div className="space-y-2.5">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. SOP: Fixing ad frequency)" className={input} />
          <div className="flex gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as BrainType)} className={input}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (e.g. Ads, Sales, Webinars)" className={input} />
          </div>
          <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What it is, in one line" className={input} />
          <input value={learnsFrom} onChange={(e) => setLearnsFrom(e.target.value)} placeholder="Learns from (e.g. Jeremy Haynes, our own tests)" className={input} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} placeholder="The full SOP or skill. Markdown works: # headings, - lists, **bold**." className={`${input} font-mono text-[13px] leading-relaxed`} />
          <div className="flex items-center gap-2">
            <button disabled={busy || !title.trim() || !body.trim()} onClick={async () => { setBusy(true); await onSave({ title: title.trim(), type, category: category.trim(), summary: summary.trim(), body, learnsFrom }); setBusy(false); }} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Saving…" : "Save"}</button>
            <button onClick={onClose} className="px-2 text-sm text-[var(--text-muted)]">Cancel</button>
            {onDelete ? <button onClick={onDelete} className="ml-auto inline-flex items-center gap-1 text-sm text-rose-600"><Trash2 size={14} /> Delete</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Jeremy AI's latest feedback on one area, with a button to get fresh feedback now. */
function JeremyAreaPanel({ area, feedback, onNew }: { area: AreaInfo; feedback: AreaFeedback | null; onNew: (f: AreaFeedback) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  async function run() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/bronson/area-feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area: area.id }) });
      const j = await r.json();
      if (r.ok) {
        onNew(j.feedback);
        setOpen(true);
      } else setError(j.error ?? "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mb-6 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[15px] font-bold text-[var(--text-strong)]"><Sparkles size={15} /> Jeremy AI on {area.label}</div>
          <div className="text-[12px] text-[var(--text-muted)]">{feedback ? `Updated ${feedback.date} · refreshes every morning` : area.about}</div>
        </div>
        <button onClick={run} disabled={busy} className="rounded-lg bg-black px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50">
          {busy ? "Jeremy is reviewing… (about a minute)" : feedback ? "Get fresh feedback" : "Get Jeremy's feedback"}
        </button>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {feedback ? (
        <div className={open ? "" : "max-h-48 overflow-hidden"}>
          <Markdown source={feedback.text} />
        </div>
      ) : null}
      {feedback ? <button onClick={() => setOpen(!open)} className="mt-1 text-[12px] font-semibold text-[var(--accent)]">{open ? "Show less" : "Read all"}</button> : null}
    </section>
  );
}
