"use client";

import { useMemo, useState } from "react";
import { AD_FORMATS, GOALS, PRODUCTION_STYLES, AWARENESS_LABELS, HOOK_TYPES, type AdFormat } from "@/lib/berlin/ad-formats";
import { Panel, Tag } from "@/components/berlin/Berlin";
import { NewFormats } from "./NewFormats";

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Detail({ f, onClose }: { f: AdFormat; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div
        className="my-4 w-full max-w-3xl rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-7 shadow-2xl sm:p-9"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">{f.name}</h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--text-muted)]">{f.tldr}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg border border-[var(--panel-border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-strong)]">
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {f.goals.map((g) => (
            <Tag key={g} tone="accent">{cap(g)}</Tag>
          ))}
          <Tag tone="muted">{f.production}</Tag>
          <Tag tone="muted">{f.length}</Tag>
          {f.awareness.map((a) => (
            <Tag key={a} tone="muted">{AWARENESS_LABELS[a]}</Tag>
          ))}
        </div>

        <Section title="Why it works"><p className="max-w-2xl text-[15px] leading-7 text-[var(--text)]">{f.why}</p></Section>

        <Section title="Structure">
          <ol className="space-y-3">
            {f.structure.map((b, i) => (
              <li key={i} className="flex gap-3.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--panel-subtle)] text-xs font-semibold text-[var(--text-muted)]">{i + 1}</span>
                <p className="text-[15px] leading-relaxed">
                  <span className="font-semibold text-[var(--text-strong)]">{b.beat}.</span> <span className="text-[var(--text-muted)]">{b.what}</span>
                </p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Template" hint="Fill in the brackets.">
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-[var(--panel-border)] bg-[var(--panel-subtle)] p-4 font-mono text-[13px] leading-7 text-[var(--text)]">{f.template}</pre>
        </Section>

        <Section title="Opening hooks">
          <ul className="space-y-2.5">
            {f.hooks.map((h, i) => (
              <li key={i} className="border-l-2 border-[var(--accent)]/40 pl-3 text-[15px] italic leading-relaxed text-[var(--text)]">&ldquo;{h}&rdquo;</li>
            ))}
          </ul>
        </Section>

        <Section title="Full example" hint="A finished script in this format.">
          <div className="whitespace-pre-wrap rounded-lg border border-[var(--panel-border)] bg-[var(--panel-subtle)] p-5 text-[15px] leading-7 text-[var(--text)]">{f.example}</div>
        </Section>

        <Section title="Mistakes to avoid">
          <ul className="space-y-2">
            {f.mistakes.map((m, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-[var(--text-muted)]">
                <span className="mt-1 text-[var(--accent)]">&bull;</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-7 border-t border-[var(--panel-border)] pt-5">
      <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-strong)]">
        {title}
        {hint ? <span className="ml-2 font-normal normal-case tracking-normal text-[var(--text-muted)]">{hint}</span> : null}
      </h3>
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
      <NewFormats />
      <h2 className="mb-3 text-lg font-bold text-[var(--text-strong)]">Core library</h2>
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
            <div className="text-[15px] font-semibold text-[var(--text-strong)]">{f.name}</div>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[var(--text-muted)]">{f.tldr}</p>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {f.goals.slice(0, 2).map((g) => (
                <Tag key={g} tone="accent">{cap(g)}</Tag>
              ))}
              <Tag tone="muted">{f.production}</Tag>
              <Tag tone="muted">{f.length}</Tag>
            </div>
            <button
              onClick={() => setOpen(f)}
              className="mt-4 self-start text-[13px] font-semibold text-[var(--accent)] hover:underline"
            >
              See the format →
            </button>
          </Panel>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Hook types</h2>
        <p className="mb-4 text-xs text-[var(--text-muted)]">The opening line: who it fits, and an example.</p>
        <div className="divide-y divide-[var(--panel-border)] overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]">
          {HOOK_TYPES.map((h) => (
            <div key={h.name} className="px-5 py-4">
              <div className="text-[15px] font-semibold text-[var(--text-strong)]">{h.name}</div>
              <div className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">{h.when}</div>
              <div className="mt-2 border-l-2 border-[var(--accent)]/40 pl-3 text-[13px] italic leading-relaxed text-[var(--text)]">&ldquo;{h.example}&rdquo;</div>
            </div>
          ))}
        </div>
      </section>

      {open ? <Detail f={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
