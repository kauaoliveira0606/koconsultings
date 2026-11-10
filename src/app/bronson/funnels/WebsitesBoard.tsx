"use client";

import { useState } from "react";
import useSWR from "swr";
import { ExternalLink, Copy, Check, GripVertical, Plus, Pencil, Trash2 } from "lucide-react";
import { BerlinHeader } from "@/components/berlin/Berlin";
import type { FunnelSection, FunnelSite } from "@/lib/berlin/websites";

type Status = { url: string; status: number; ms: number };
type Drag = { kind: "site"; siteId: string } | { kind: "section"; sectionId: string } | null;

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const input =
  "w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2.5 py-1.5 text-[13px] text-[var(--text-strong)] outline-none focus:border-[var(--accent)]";

function StatusDot({ check }: { check?: Status }) {
  if (!check) return <span className="h-2 w-2 shrink-0 rounded-full bg-neutral-300" title="Checking…" />;
  const ok = check.status >= 200 && check.status < 400;
  return <span className={`h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`} title={ok ? `Live · ${check.ms} ms` : `Down (${check.status || "no response"})`} />;
}

/**
 * Every Bronson website by section. Drag a site to move it within or between
 * sections; drag a section by its handle to reorder sections. Order saves to Airtable.
 */
export function WebsitesBoard() {
  const { data, mutate } = useSWR<{ sections: FunnelSection[] }>("/api/bronson/websites", fetcher);
  const { data: status } = useSWR<{ results: Status[] }>("/api/bronson/websites/status", fetcher);
  // Local copy while a drag is saving; otherwise the server's order.
  const [local, setLocal] = useState<FunnelSection[] | null>(null);
  const sections = local ?? data?.sections ?? [];
  const [drag, setDrag] = useState<Drag>(null);
  const [over, setOver] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [newSection, setNewSection] = useState(false);

  const checks = new Map((status?.results ?? []).map((r) => [r.url, r]));
  const total = sections.reduce((n, s) => n + s.sites.length, 0);
  const down = (status?.results ?? []).filter((r) => !(r.status >= 200 && r.status < 400)).length;
  const query = q.trim().toLowerCase();
  const filtering = query.length > 0;

  async function post(payload: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/bronson/websites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      await mutate(json, false);
      setLocal(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setLocal(null);
      mutate();
      return false;
    } finally {
      setSaving(false);
    }
  }

  function persist(next: FunnelSection[]) {
    setLocal(next);
    post({
      action: "layout",
      layout: {
        sections: next.map((s) => ({ id: s.id, name: s.name })),
        sites: next.map((s) => s.sites.map((x) => ({ id: x.id, section: s.name }))),
      },
    });
  }

  /** Move a site to a section, before `beforeId` (or at the end). */
  function moveSite(siteId: string, toSectionId: string, beforeId: string | null) {
    if (siteId === beforeId) return;
    let moving: FunnelSite | undefined;
    const stripped = sections.map((s) => {
      const found = s.sites.find((x) => x.id === siteId);
      if (found) moving = found;
      return { ...s, sites: s.sites.filter((x) => x.id !== siteId) };
    });
    if (!moving) return;
    const next = stripped.map((s) => {
      if (s.id !== toSectionId) return s;
      const sites = [...s.sites];
      const at = beforeId ? sites.findIndex((x) => x.id === beforeId) : -1;
      sites.splice(at < 0 ? sites.length : at, 0, { ...moving!, section: s.name });
      return { ...s, sites };
    });
    persist(next);
  }

  function moveSection(sectionId: string, beforeId: string) {
    if (sectionId === beforeId) return;
    const moving = sections.find((s) => s.id === sectionId);
    if (!moving) return;
    const rest = sections.filter((s) => s.id !== sectionId);
    const at = rest.findIndex((s) => s.id === beforeId);
    rest.splice(at < 0 ? rest.length : at, 0, moving);
    persist(rest);
  }

  function onDropSite(e: React.DragEvent, sectionId: string, beforeId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    setOver(null);
    if (drag?.kind === "site") moveSite(drag.siteId, sectionId, beforeId);
    if (drag?.kind === "section" && !beforeId) moveSection(drag.sectionId, sectionId);
    setDrag(null);
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <BerlinHeader
          title="Funnel"
          subtitle={`Every Bronson website, ${total} in all. Drag sites between sections, drag a section by its handle to reorder.${status ? (down ? ` ${down} not responding.` : " All live.") : ""}`}
        />
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[var(--text-muted)]">{saving ? "Saving…" : ""}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages" className="w-48 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <button onClick={() => setNewSection(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Plus size={15} /> Section
          </button>
        </div>
      </div>
      {error ? <p className="mb-4 rounded-md bg-[var(--cell-red-bg)] px-3 py-2 text-sm text-[var(--cell-red-text)]">{error}</p> : null}
      {filtering ? <p className="mb-4 text-[12px] text-[var(--text-muted)]">Clear the search to drag and drop.</p> : null}

      {newSection ? (
        <SectionForm
          onCancel={() => setNewSection(false)}
          onSave={async (name, description) => {
            if (await post({ action: "addSection", name, description })) setNewSection(false);
          }}
        />
      ) : null}

      {!data ? <p className="text-sm text-[var(--text-muted)]">Loading…</p> : null}

      <div className="space-y-6">
        {sections.map((sec) => {
          const sites = sec.sites.filter(
            (s) => !filtering || s.name.toLowerCase().includes(query) || s.url.toLowerCase().includes(query) || s.description.toLowerCase().includes(query),
          );
          if (filtering && !sites.length) return null;
          const isOver = over === `sec:${sec.id}`;
          return (
            <section
              key={sec.id}
              onDragOver={(e) => {
                if (filtering || !drag) return;
                e.preventDefault();
                setOver(`sec:${sec.id}`);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === `sec:${sec.id}` ? null : o));
              }}
              onDrop={(e) => onDropSite(e, sec.id, null)}
              className={`rounded-2xl border-2 p-4 transition-colors ${isOver ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-transparent"} ${drag?.kind === "section" && drag.sectionId === sec.id ? "opacity-50" : ""}`}
            >
              {editingSection === sec.id ? (
                <SectionForm
                  initial={{ name: sec.name, description: sec.description }}
                  onCancel={() => setEditingSection(null)}
                  onDelete={sec.sites.length === 0 ? async () => { if (await post({ action: "deleteSection", id: sec.id })) setEditingSection(null); } : undefined}
                  onSave={async (name, description) => {
                    if (await post({ action: "renameSection", id: sec.id, name, description })) setEditingSection(null);
                  }}
                />
              ) : (
                <div className="mb-3 flex items-center gap-2">
                  {!filtering && sec.id !== "unsorted" ? (
                    <span
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", sec.id);
                        setDrag({ kind: "section", sectionId: sec.id });
                      }}
                      onDragEnd={() => { setDrag(null); setOver(null); }}
                      className="cursor-grab text-[var(--text-muted)] hover:text-[var(--text-strong)] active:cursor-grabbing"
                      title="Drag to reorder sections"
                    >
                      <GripVertical size={18} />
                    </span>
                  ) : null}
                  <h2 className="text-lg font-bold text-[var(--text-strong)]">{sec.name}</h2>
                  <span className="text-[13px] text-[var(--text-muted)]">{sec.sites.length}</span>
                  {sec.id !== "unsorted" ? (
                    <button onClick={() => setEditingSection(sec.id)} className="ml-1 text-[var(--text-muted)] hover:text-[var(--text-strong)]" aria-label="Edit section">
                      <Pencil size={13} />
                    </button>
                  ) : null}
                  <button onClick={() => setAddingIn(sec.id)} className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--accent)]">
                    <Plus size={14} /> Add site
                  </button>
                </div>
              )}
              {sec.description && editingSection !== sec.id ? <p className="-mt-2 mb-3 text-[13px] text-[var(--text-muted)]">{sec.description}</p> : null}

              {addingIn === sec.id ? (
                <SiteForm
                  onCancel={() => setAddingIn(null)}
                  onSave={async (f) => { if (await post({ action: "addSite", section: sec.name, ...f })) setAddingIn(null); }}
                />
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {sites.map((s) =>
                  editing === s.id ? (
                    <SiteForm
                      key={s.id}
                      initial={s}
                      onCancel={() => setEditing(null)}
                      onDelete={async () => { if (await post({ action: "deleteSite", id: s.id })) setEditing(null); }}
                      onSave={async (f) => { if (await post({ action: "updateSite", id: s.id, ...f })) setEditing(null); }}
                    />
                  ) : (
                    <SiteCard
                      key={s.id}
                      site={s}
                      check={checks.get(s.url)}
                      copied={copied === s.url}
                      draggable={!filtering}
                      dragging={drag?.kind === "site" && drag.siteId === s.id}
                      highlight={over === `site:${s.id}`}
                      sections={sections}
                      currentSectionId={sec.id}
                      onCopy={() => copy(s.url)}
                      onEdit={() => setEditing(s.id)}
                      onMove={(toId) => moveSite(s.id, toId, null)}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", s.id);
                        setDrag({ kind: "site", siteId: s.id });
                      }}
                      onDragEnd={() => { setDrag(null); setOver(null); }}
                      onDragOver={(e) => {
                        if (filtering || drag?.kind !== "site") return;
                        e.preventDefault();
                        e.stopPropagation();
                        setOver(`site:${s.id}`);
                      }}
                      onDrop={(e) => onDropSite(e, sec.id, s.id)}
                    />
                  ),
                )}
                {sites.length === 0 && addingIn !== sec.id ? (
                  <div className="col-span-full rounded-xl border-2 border-dashed border-[var(--panel-border)] px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">
                    Drop a site here, or add one.
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SiteCard(props: {
  site: FunnelSite;
  check?: Status;
  copied: boolean;
  draggable: boolean;
  dragging: boolean;
  highlight: boolean;
  sections: FunnelSection[];
  currentSectionId: string;
  onCopy: () => void;
  onEdit: () => void;
  onMove: (sectionId: string) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const { site: s } = props;
  const display = s.url.replace(/^https?:\/\/(www\.)?/, "");
  return (
    <div
      draggable={props.draggable}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
      className={`group relative flex flex-col rounded-xl border bg-[var(--panel-bg)] p-4 transition-all ${props.draggable ? "cursor-grab active:cursor-grabbing" : ""} ${
        props.dragging ? "opacity-40" : ""
      } ${props.highlight ? "border-[var(--accent)] shadow-[inset_4px_0_0_var(--accent)]" : "border-[var(--panel-border)] hover:border-[var(--accent)]/40"}`}
    >
      <div className="flex items-center gap-2">
        {props.draggable ? <GripVertical size={14} className="shrink-0 text-[var(--text-muted)] opacity-50 group-hover:opacity-100" /> : null}
        <StatusDot check={props.check} />
        <span className="truncate text-[15px] font-semibold text-[var(--text-strong)]">{s.name}</span>
        <button onClick={props.onEdit} className="ml-auto shrink-0 text-[var(--text-muted)] opacity-0 hover:text-[var(--text-strong)] group-hover:opacity-100" aria-label="Edit site">
          <Pencil size={13} />
        </button>
      </div>
      <a href={s.url} target="_blank" rel="noreferrer" draggable={false} className="mt-1 truncate text-[13px] font-medium text-[var(--accent)] hover:underline">
        {display}
      </a>
      {s.description ? <p className="mt-1.5 text-[13px] leading-snug text-[var(--text-muted)]">{s.description}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <a href={s.url} target="_blank" rel="noreferrer" draggable={false}
          className="inline-flex items-center gap-1.5 rounded-md bg-black px-2.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90">
          <ExternalLink size={13} /> Open
        </a>
        <button onClick={props.onCopy}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--panel-border)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-strong)] hover:bg-[var(--panel-subtle)]">
          {props.copied ? <Check size={13} /> : <Copy size={13} />} {props.copied ? "Copied" : "Copy link"}
        </button>
        {/* Move menu: same as dragging, for touch screens */}
        <select
          value=""
          onChange={(e) => e.target.value && props.onMove(e.target.value)}
          className="ml-auto rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[11px] text-[var(--text-muted)]"
          aria-label="Move to section"
        >
          <option value="">Move to…</option>
          {props.sections.filter((x) => x.id !== props.currentSectionId && x.id !== "unsorted").map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SiteForm({ initial, onSave, onCancel, onDelete }: {
  initial?: { name: string; url: string; description: string };
  onSave: (f: { name: string; url: string; description: string }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  return (
    <div className="mb-3 space-y-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--panel-bg)] p-4">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={input} />
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={input} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it is (optional)" rows={2} className={input} />
      <div className="flex items-center gap-2">
        <button disabled={!name.trim() || !/^https?:\/\//.test(url.trim())} onClick={() => onSave({ name: name.trim(), url: url.trim(), description: description.trim() })}
          className="rounded-md bg-black px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40">Save</button>
        <button onClick={onCancel} className="px-2 text-[12px] text-[var(--text-muted)]">Cancel</button>
        {onDelete ? (
          <button onClick={onDelete} className="ml-auto inline-flex items-center gap-1 text-[12px] text-rose-600"><Trash2 size={13} /> Delete</button>
        ) : null}
      </div>
    </div>
  );
}

function SectionForm({ initial, onSave, onCancel, onDelete }: {
  initial?: { name: string; description: string };
  onSave: (name: string, description: string) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  return (
    <div className="mb-4 space-y-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--panel-bg)] p-4">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Section name" className={input} />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className={input} />
      <div className="flex items-center gap-2">
        <button disabled={!name.trim()} onClick={() => onSave(name.trim(), description.trim())} className="rounded-md bg-black px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40">Save</button>
        <button onClick={onCancel} className="px-2 text-[12px] text-[var(--text-muted)]">Cancel</button>
        {onDelete ? (
          <button onClick={onDelete} className="ml-auto inline-flex items-center gap-1 text-[12px] text-rose-600"><Trash2 size={13} /> Delete section</button>
        ) : null}
      </div>
    </div>
  );
}
