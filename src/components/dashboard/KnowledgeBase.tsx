"use client";

import { useState } from "react";
import type { KbGroup, KbItem, KbSection } from "@/lib/knowledge-base/types";

/**
 * Knowledge Base tab: one collapsible folder per section, each holding titled
 * groups of cards. Content is static (src/lib/knowledge-base/<offer>.ts).
 */
export function KnowledgeBase({ sections }: { sections: KbSection[] }) {
  return (
    <div className="flex flex-col gap-3">
      {sections.map((section) => (
        <SectionFolder key={section.id} section={section} />
      ))}
    </div>
  );
}

function SectionFolder({ section }: { section: KbSection }) {
  const count = section.groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <details className="group rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <Chevron />
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-[var(--text-strong)]">{section.title}</div>
          <div className="text-sm text-[var(--text-muted)]">{section.description}</div>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--panel-border)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </summary>
      <div className="flex flex-col gap-6 border-t border-[var(--panel-border)] p-4">
        {section.groups.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nothing added yet.</p>
        ) : (
          section.groups.map((g) => <Group key={g.title} group={g} />)
        )}
      </div>
    </details>
  );
}

function Group({ group }: { group: KbGroup }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-strong)]">{group.title}</h3>
      {group.description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{group.description}</p> : null}
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.items.map((item, i) => (
          <ItemCard key={`${item.title}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: KbItem }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-[var(--panel-border)] bg-[var(--panel-subtle)] p-3 text-sm">
      {item.image ? (
        <a href={item.image} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- external screenshots, shown as-is */}
          <img
            src={item.image}
            alt={item.title}
            className="max-h-56 w-full rounded border border-[var(--panel-border)] object-cover object-top"
          />
        </a>
      ) : null}
      <div>
        <div className="font-semibold text-[var(--text-strong)]">{item.title}</div>
        {item.meta ? <div className="text-xs text-[var(--text-muted)]">{item.meta}</div> : null}
      </div>
      {item.text?.map((p, i) => (
        <p key={i} className="text-[var(--text)]">
          {p}
        </p>
      ))}
      {item.bullets?.length ? (
        <ul className="list-disc space-y-1 pl-5 text-[var(--text)]">
          {item.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ) : null}
      {item.quote ? (
        <blockquote className="border-l-2 border-[var(--accent)] pl-3 italic text-[var(--text)]">
          &ldquo;{item.quote}&rdquo;
        </blockquote>
      ) : null}
      {item.copy ? <CopyBlock text={item.copy} /> : null}
      {item.note ? (
        <p className="rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1.5 text-xs text-amber-200">
          {item.note}
        </p>
      ) : null}
      {item.links?.length ? (
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1">
          {item.links.map((l) => (
            <a
              key={l.href + l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              {l.label} ↗
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context): the text is still selectable.
    }
  }
  return (
    <div className="flex items-start gap-2 rounded border border-[var(--panel-border)] bg-[var(--panel-bg)] p-2">
      <p className="min-w-0 flex-1 break-words text-xs text-[var(--text)]">{text}</p>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded border border-[var(--panel-border)] px-2 py-0.5 text-xs text-[var(--text-muted)] hover:bg-[var(--panel-subtle)] hover:text-[var(--text-strong)]"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-90"
    >
      <path d="M5 2.5L9.5 7 5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
