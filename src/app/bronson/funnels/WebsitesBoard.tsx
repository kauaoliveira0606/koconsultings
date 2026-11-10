"use client";

import { useState } from "react";
import useSWR from "swr";
import { ExternalLink, Copy, Check } from "lucide-react";
import { BerlinHeader } from "@/components/berlin/Berlin";
import { WEBSITE_GROUPS, siteUrl } from "@/lib/berlin/websites";

type Check = { url: string; status: number; ms: number };
const fetcher = (url: string) => fetch(url).then((r) => r.json());

function StatusDot({ check }: { check?: Check }) {
  if (!check) return <span className="h-2 w-2 rounded-full bg-neutral-300" title="Checking…" />;
  const ok = check.status >= 200 && check.status < 400;
  return <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`} title={ok ? `Live · ${check.ms} ms` : `Down (${check.status || "no response"})`} />;
}

/** Every Bronson website, grouped by funnel stage, with a live up/down check and open/copy links. */
export function WebsitesBoard() {
  const { data } = useSWR<{ checkedAt: string; results: Check[] }>("/api/bronson/websites", fetcher);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const checks = new Map((data?.results ?? []).map((r) => [r.url, r]));

  const total = WEBSITE_GROUPS.reduce((n, g) => n + g.sites.length, 0);
  const down = (data?.results ?? []).filter((r) => !(r.status >= 200 && r.status < 400));
  const query = q.trim().toLowerCase();

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
          subtitle={`Every Bronson website, ${total} in all, grouped by funnel stage.${data ? (down.length ? ` ${down.length} not responding.` : " All live.") : ""}`}
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search pages"
          className="w-56 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="space-y-10">
        {WEBSITE_GROUPS.map((g) => {
          const sites = g.sites.filter(
            (s) => !query || s.name.toLowerCase().includes(query) || siteUrl(s).toLowerCase().includes(query) || s.description.toLowerCase().includes(query),
          );
          if (!sites.length) return null;
          return (
            <section key={g.title}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="text-lg font-bold text-[var(--text-strong)]">{g.title}</h2>
                <span className="text-[13px] text-[var(--text-muted)]">{sites.length}</span>
              </div>
              {g.description ? <p className="-mt-2 mb-3 text-[13px] text-[var(--text-muted)]">{g.description}</p> : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {sites.map((s) => {
                  const url = siteUrl(s);
                  const display = url.replace(/^https?:\/\/(www\.)?/, "");
                  return (
                    <div key={url} className="group flex flex-col rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 transition-colors hover:border-[var(--accent)]/40">
                      <div className="flex items-center gap-2">
                        <StatusDot check={checks.get(url)} />
                        <span className="truncate text-[15px] font-semibold text-[var(--text-strong)]">{s.name}</span>
                      </div>
                      <a href={url} target="_blank" rel="noreferrer" className="mt-1 truncate text-[13px] font-medium text-[var(--accent)] hover:underline">
                        {display}
                      </a>
                      {s.description ? <p className="mt-1.5 text-[13px] leading-snug text-[var(--text-muted)]">{s.description}</p> : null}
                      <div className="mt-auto flex gap-2 pt-3">
                        <a href={url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md bg-black px-2.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90">
                          <ExternalLink size={13} /> Open
                        </a>
                        <button onClick={() => copy(url)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--panel-border)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-strong)] hover:bg-[var(--panel-subtle)]">
                          {copied === url ? <Check size={13} /> : <Copy size={13} />} {copied === url ? "Copied" : "Copy link"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
