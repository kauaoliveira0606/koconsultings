"use client";

import { useState } from "react";
import useSWR from "swr";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

type A = { key: string; level: "red" | "yellow"; title: string; detail: string; firstAt: string; sop?: { id: string; title: string } | null };
const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Active ad problems from the hourly check. Hidden when everything is inside the lines. */
export function AlertsBanner() {
  const { data } = useSWR<{ alerts: A[] }>("/api/bronson/alerts", fetcher, { refreshInterval: 300_000 });
  const [open, setOpen] = useState(false);
  const alerts = Array.isArray(data?.alerts) ? data!.alerts : [];
  if (!alerts.length) return null;
  const red = alerts.filter((a) => a.level === "red").length;
  const shown = open ? alerts : alerts.slice(0, 3);
  return (
    <div className="mb-6 rounded-xl border p-4" style={{ background: red ? "var(--cell-red-bg)" : "var(--cell-yellow-bg)", borderColor: "transparent" }}>
      <div className="flex items-center gap-2 text-[15px] font-bold" style={{ color: red ? "var(--cell-red-text)" : "var(--cell-yellow-text)" }}>
        <AlertTriangle size={17} /> {alerts.length} problem{alerts.length === 1 ? "" : "s"} right now
      </div>
      <ul className="mt-2 space-y-1.5">
        {shown.map((a) => (
          <li key={a.key} className="text-[13px] leading-snug" style={{ color: a.level === "red" ? "var(--cell-red-text)" : "var(--cell-yellow-text)" }}>
            <span className="font-semibold">{a.level === "red" ? "🔴" : "🟡"} {a.title}.</span> {a.detail}
            {a.sop ? (
              <a href={`/bronson/brain?doc=${a.sop.id}`} className="ml-1 font-semibold underline">Fix with: {a.sop.title}</a>
            ) : null}
          </li>
        ))}
      </ul>
      {alerts.length > 3 ? (
        <button onClick={() => setOpen(!open)} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: red ? "var(--cell-red-text)" : "var(--cell-yellow-text)" }}>
          {open ? <>Show less <ChevronUp size={13} /></> : <>Show all {alerts.length} <ChevronDown size={13} /></>}
        </button>
      ) : null}
    </div>
  );
}
