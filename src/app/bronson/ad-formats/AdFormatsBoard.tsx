"use client";

import { useMemo, useState } from "react";
import { AD_FORMATS, GOALS, PRODUCTION_STYLES, AWARENESS_LABELS, HOOK_TYPES, type AdFormat } from "@/lib/berlin/ad-formats";
import { Panel, Tag } from "@/components/berlin/Berlin";

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Detail({ f, onClose }: { f: AdFormat; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div
        className="my-4 w-full max-w-2xl rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-strong)]">{f.name}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{f.tldr}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-md border border-[var(--panel-border)] px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)]">
            Close
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {f.goals.map((g) => (
            <Tag key={g} tone="accent">{cap(g)}</Tag>
          ))}
          <Tag tone="muted">{f.production}</Tag>
          <Tag tone="muted">{f.length}</Tag>
          {f.awareness.map((a) => (
            <Tag key={a} tone="muted">{AWARENESS_LABELS[a]}</Tag>
          ))}
        </div>

        <Section title="Why it works"><p className="text-sm leading-relaxed text-[var(--text)]">{f.why}</p></Section>

        <Section title="Structure">
          <ol className="space-y-2">
            {f.structure.map((b, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--panel-subtle)] text-[11px] font-semibold text-[var(--text-muted)]">{i + 1}</span>
                <span><span className="font-semibold text-[var(--text-strong)]">{b.beat}.</span> <span className="text-[var(--text-muted)]">{b.what}</span></span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Template">
          <pre className="whitespace-pre-wrap rounded-md bg-[var(--panel-subtle)] p-3 text-xs leading-relaxed text-[var(--text)]">{f.template}</pre>
        </Section>

        <Section title="Opening hooks">
          <ul className="space-y-1.5">
            {f.hooks.map((h, i) => (
              <li key={i} className="text-sm italic text-[var(--text)]">&ldquo;{h}&rdquo;</li>
            ))}
          </ul>
        </Section>

        <Section title="Full example">
          <pre className="whitespace-pre-wrap rounded-md bg-[var(--panel-subtle)] p-3 text-xs leading-relaxed text-[var(--text)]">{f.example}</pre>
        </Section>

        <Section title="Mistakes to avoid">
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-muted)]">
            {f.mistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</h3>
      {children}
    </div>
  );
}

export function AdFormatsBoard() {
  const [goal, setGoal] = useState("");
  const [prod, setProd] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<AdFormat | null>(null);

  const filtered = useMemo(
    () =>
      AD_FORMATS.filter(
        (f) =>
          (!goal || f.goals.includes(goal)) &&
          (!prod || f.production === prod) &&
          (!q || (f.name + " " + f.tldr).toLowerCase().includes(q.toLowerCase())),
      ),
    [goal, prod, q],
  );

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
      active
        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
        : "border-[var(--panel-border)] bg-[var(--panel-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]"
    }`;

  return (
    <div>
      <div className="mb-5 space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search formats"
          className="w-full max-w-sm rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--accent)]"
        />
        <div className="flex flex-wrap gap-2">
          <button className={chip(!goal)} onClick={() => setGoal("")}>Any goal</button>
          {GOALS.map((g) => (
            <button key={g} className={chip(goal === g)} onClick={() => setGoal(goal === g ? "" : g)}>{cap(g)}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={chip(!prod)} onClick={() => setProd("")}>Any style</button>
          {PRODUCTION_STYLES.map((s) => (
            <button key={s} className={chip(prod === s)} onClick={() => setProd(prod === s ? "" : s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="mb-4 text-xs text-[var(--text-muted)]">{filtered.length} of {AD_FORMATS.length}</div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((f) => (
          <Panel key={f.id} className="flex flex-col">
            <div className="text-sm font-semibold text-[var(--text-strong)]">{f.name}</div>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-[var(--text-muted)]">{f.tldr}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {f.goals.slice(0, 2).map((g) => (
                <Tag key={g} tone="accent">{cap(g)}</Tag>
              ))}
              <Tag tone="muted">{f.production}</Tag>
              <Tag tone="muted">{f.length}</Tag>
            </div>
            <button
              onClick={() => setOpen(f)}
              className="mt-3 self-start text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              See the format →
            </button>
          </Panel>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Hook types</h2>
        <p className="mb-4 text-xs text-[var(--text-muted)]">The opening line: who it fits, and an example.</p>
        <div className="divide-y divide-[var(--panel-border)] overflow-hidden rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]">
          {HOOK_TYPES.map((h) => (
            <div key={h.name} className="px-4 py-3">
              <div className="text-sm font-semibold text-[var(--text-strong)]">{h.name}</div>
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">{h.when}</div>
              <div className="mt-1 text-xs italic text-[var(--text)]">&ldquo;{h.example}&rdquo;</div>
            </div>
          ))}
        </div>
      </section>

      {open ? <Detail f={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
