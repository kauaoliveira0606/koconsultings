"use client";

import { useState, type ReactNode } from "react";
import type { KbGroup, KbItem, KbSection, KbSectionId } from "@/lib/knowledge-base/types";

/**
 * Knowledge Base tab: one collapsible folder per section. Each group inside
 * picks its own layout (pricing columns, link rows, win gallery, quotes...).
 * Content is static (src/lib/knowledge-base/<offer>.ts).
 *
 * The deepspace theme paints every text token white, so hierarchy here comes
 * from size, weight and opacity rather than the muted color token.
 */

const SECTION_STYLE: Record<KbSectionId, { tile: string; icon: ReactNode }> = {
  offers: {
    tile: "bg-sky-400/15 text-sky-300 ring-sky-300/30",
    icon: <path d="M3 7l7-4 7 4v6l-7 4-7-4V7zm0 0l7 4m0 0l7-4m-7 4v6" />,
  },
  content: {
    tile: "bg-emerald-400/15 text-emerald-300 ring-emerald-300/30",
    icon: <path d="M4 4h12v12H4zM8.5 7.5v5l4-2.5-4-2.5z" />,
  },
  wins: {
    tile: "bg-amber-400/15 text-amber-300 ring-amber-300/30",
    icon: <path d="M6 3h8v4a4 4 0 01-8 0V3zm4 8v3m-3 3h6M6 5H3.5a2.5 2.5 0 002.7 3M14 5h2.5a2.5 2.5 0 01-2.7 3" />,
  },
  disclaimers: {
    tile: "bg-rose-400/15 text-rose-300 ring-rose-300/30",
    icon: <path d="M10 2.5l6 2.5v4.5c0 4-2.6 6.8-6 8-3.4-1.2-6-4-6-8V5l6-2.5zM7.5 10l2 2 3.5-4" />,
  },
};

export function KnowledgeBase({ sections }: { sections: KbSection[] }) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <SectionFolder key={section.id} section={section} />
      ))}
    </div>
  );
}

function SectionFolder({ section }: { section: KbSection }) {
  const count = section.groups.reduce((n, g) => n + g.items.length, 0);
  const style = SECTION_STYLE[section.id];
  return (
    <details className="group/folder overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-sm open:shadow-lg">
      <summary className="flex cursor-pointer list-none items-center gap-4 p-5 transition-colors hover:bg-[var(--panel-subtle)] [&::-webkit-details-marker]:hidden">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${style.tile}`}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {style.icon}
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-[var(--text-strong)]">{section.title}</div>
          <div className="text-sm text-[var(--text-muted)] opacity-70">{section.description}</div>
        </div>
        <span className="hidden shrink-0 rounded-full bg-[var(--panel-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] sm:inline">
          {count} {count === 1 ? "item" : "items"}
        </span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-[var(--text-muted)] opacity-70 transition-transform group-open/folder:rotate-180">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="flex flex-col gap-10 border-t border-[var(--panel-border)] px-5 pb-6 pt-6">
        {section.groups.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] opacity-70">Nothing added yet.</p>
        ) : (
          section.groups.map((g) => <Group key={g.title} group={g} />)
        )}
      </div>
    </details>
  );
}

function Group({ group }: { group: KbGroup }) {
  return (
    <section>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[var(--text-strong)]">{group.title}</h3>
        {group.description ? (
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--text-muted)] opacity-70">{group.description}</p>
        ) : null}
      </div>
      <GroupBody group={group} />
    </section>
  );
}

function GroupBody({ group }: { group: KbGroup }) {
  switch (group.layout) {
    case "pricing":
      return (
        <div className="grid gap-4 lg:grid-cols-3">
          {group.items.map((item) => (
            <PricingCard key={item.title} item={item} />
          ))}
        </div>
      );
    case "rows":
      return (
        <div className="divide-y divide-[var(--panel-border)] overflow-hidden rounded-lg border border-[var(--panel-border)]">
          {group.items.map((item) => (
            <LinkRow key={item.title} item={item} />
          ))}
        </div>
      );
    case "gallery":
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {group.items.map((item, i) => (
            <WinCard key={`${item.title}-${i}`} item={item} />
          ))}
        </div>
      );
    case "quotes":
      return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {group.items.map((item) => (
            <QuoteCard key={item.title} item={item} />
          ))}
        </div>
      );
    case "stack":
      return (
        <div className="flex flex-col gap-4">
          {group.items.map((item) => (
            <Card key={item.title} item={item} wide />
          ))}
        </div>
      );
    default:
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {group.items.map((item) => (
            <Card key={item.title} item={item} />
          ))}
        </div>
      );
  }
}

const CARD = "rounded-lg border border-[var(--panel-border)] bg-[var(--panel-subtle)]";

function Card({ item, wide }: { item: KbItem; wide?: boolean }) {
  return (
    <div className={`${CARD} flex min-w-0 flex-col gap-3 p-5`}>
      <div>
        <div className="text-base font-semibold text-[var(--text-strong)]">{item.title}</div>
        {item.meta ? <div className="mt-0.5 text-xs text-[var(--text-muted)] opacity-70">{item.meta}</div> : null}
      </div>
      <div className={`flex flex-col gap-3 ${wide ? "max-w-3xl" : ""}`}>
        {item.text?.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-[var(--text)] opacity-90">
            {p}
          </p>
        ))}
        {item.bullets?.length ? <CheckList items={item.bullets} /> : null}
        {item.quote ? (
          <blockquote className="border-l-2 border-amber-300/60 pl-3 text-sm italic leading-relaxed text-[var(--text)]">
            &ldquo;{item.quote}&rdquo;
          </blockquote>
        ) : null}
      </div>
      {item.copy ? <CopyBlock text={item.copy} /> : null}
      {item.note ? <Note text={item.note} /> : null}
      {item.links?.length ? <Links links={item.links} /> : null}
    </div>
  );
}

function PricingCard({ item }: { item: KbItem }) {
  const featured = Boolean(item.badge);
  return (
    <div
      className={`flex min-w-0 flex-col rounded-xl border p-6 ${
        featured
          ? "border-sky-300/50 bg-sky-400/10 ring-1 ring-sky-300/30"
          : "border-[var(--panel-border)] bg-[var(--panel-subtle)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-4xl font-bold tracking-tight text-[var(--text-strong)]">{item.title}</div>
        {item.badge ? (
          <span className="rounded-full bg-sky-300/20 px-2.5 py-1 text-xs font-semibold text-sky-200">{item.badge}</span>
        ) : null}
      </div>
      {item.meta ? (
        <div className="mt-2 inline-flex w-fit rounded-full bg-[var(--panel-bg)] px-2.5 py-1 text-xs font-medium text-[var(--text)]">
          {item.meta}
        </div>
      ) : null}
      <div className="my-5 h-px bg-[var(--panel-border)]" />
      {item.bullets?.length ? <CheckList items={item.bullets} /> : null}
    </div>
  );
}

function LinkRow({ item }: { item: KbItem }) {
  const href = item.links?.[0]?.href;
  return (
    <div className="flex flex-col gap-3 bg-[var(--panel-subtle)] p-4 sm:flex-row sm:items-start sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[15px] font-semibold text-[var(--text-strong)]">{item.title}</span>
          {item.meta ? <span className="text-xs text-[var(--text-muted)] opacity-60">{item.meta}</span> : null}
        </div>
        {item.text?.map((p, i) => (
          <p key={i} className="mt-1 text-sm leading-relaxed text-[var(--text)] opacity-75">
            {p}
          </p>
        ))}
        {item.bullets?.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {item.bullets.map((b) => (
              <span key={b} className="rounded-full border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2.5 py-0.5 text-xs text-[var(--text)] opacity-90">
                {b}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-300/30 hover:bg-emerald-400/25"
          >
            {item.links?.[0]?.label ?? "Open"} ↗
          </a>
        ) : null}
        {item.copy ? <CopyButton text={item.copy} label="Copy link" /> : null}
      </div>
    </div>
  );
}

function WinCard({ item }: { item: KbItem }) {
  return (
    <div className={`${CARD} flex min-w-0 flex-col overflow-hidden`}>
      {item.image ? (
        <a href={item.image} target="_blank" rel="noopener noreferrer" className="group/img relative block bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element -- external screenshots, shown as-is */}
          <img
            src={item.image}
            alt={item.title}
            className="aspect-[4/3] w-full object-cover object-top transition-opacity group-hover/img:opacity-80"
          />
          <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover/img:opacity-100">
            View full size
          </span>
        </a>
      ) : null}
      <div className="flex flex-col gap-1 p-4">
        <div className="text-[15px] font-semibold text-amber-200">{item.title}</div>
        {item.meta ? <div className="text-xs text-[var(--text-muted)] opacity-70">{item.meta}</div> : null}
        {item.quote ? <p className="mt-1.5 text-sm leading-relaxed text-[var(--text)] opacity-90">&ldquo;{item.quote}&rdquo;</p> : null}
      </div>
    </div>
  );
}

function QuoteCard({ item }: { item: KbItem }) {
  return (
    <div className={`${CARD} flex min-w-0 flex-col p-5`}>
      <div className="font-serif text-4xl leading-none text-amber-300/70" aria-hidden="true">
        &ldquo;
      </div>
      <p className="mt-1 flex-1 text-[15px] leading-relaxed text-[var(--text)]">{item.quote}</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--text-strong)]">{item.title}</span>
        {item.links?.[0] ? (
          <a href={item.links[0].href} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-amber-200 hover:underline">
            {item.links[0].label} ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((text, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-[var(--text)]">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-300">
            <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

function Note({ text }: { text: string }) {
  return (
    <div className="flex gap-2 rounded-md border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
      <span aria-hidden="true">⚠</span>
      <span>{text}</span>
    </div>
  );
}

function Links({ links }: { links: NonNullable<KbItem["links"]> }) {
  return (
    <div className="mt-auto flex flex-wrap gap-2 pt-1">
      {links.map((l) => (
        <a
          key={l.href + l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-[var(--panel-border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--panel-bg)]"
        >
          {l.label} ↗
        </a>
      ))}
    </div>
  );
}

function useCopy(text: string) {
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
  return { copied, copy };
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const { copied, copy } = useCopy(text);
  return (
    <button
      type="button"
      onClick={copy}
      className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${
        copied
          ? "bg-emerald-400/20 text-emerald-200 ring-emerald-300/40"
          : "bg-[var(--panel-bg)] text-[var(--text)] ring-[var(--panel-border)] hover:bg-[var(--panel-subtle)]"
      }`}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

function CopyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <p className="max-w-3xl text-sm leading-relaxed text-[var(--text)]">{text}</p>
      <div className="mt-3 flex justify-end">
        <CopyButton text={text} />
      </div>
    </div>
  );
}
