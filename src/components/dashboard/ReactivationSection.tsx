"use client";

import { useState } from "react";
import useSWR from "swr";
import { MetricGroups } from "@/components/dashboard/MetricGroups";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue } from "@/lib/format";
import type { ReactivationOffer } from "@/lib/airtable/reactivation";
import type { ConversationStatus, ReactivationResponse } from "@/lib/reactivation";

const SERIES = [
  { key: "texts", label: "Texts sent", color: "#3987e5" },
  { key: "replies", label: "Replies", color: "#d95926" },
  { key: "closes", label: "Closes", color: "#199e70" },
] as const;

const STATUS_STYLE: Record<ConversationStatus, string> = {
  Texted: "bg-slate-400/15 text-slate-200 ring-slate-300/30",
  Replied: "bg-sky-400/15 text-sky-100 ring-sky-300/40",
  Booked: "bg-indigo-400/15 text-indigo-100 ring-indigo-300/40",
  Closed: "bg-emerald-400/15 text-emerald-100 ring-emerald-300/40",
  "Not now": "bg-amber-400/15 text-amber-100 ring-amber-300/40",
  "Opted out": "bg-rose-400/15 text-rose-100 ring-rose-300/40",
};

const OPT_OUT_LIMIT = 0.03;

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function roiLabel(roi: number | null): string | undefined {
  if (roi === null) return undefined;
  return `${roi >= 100 ? Math.round(roi).toLocaleString("en-US") : roi.toFixed(1)}x`;
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

/** Texts, replies and closes per day on one count axis, with a hover readout. */
function DailyChart({ data }: { data: ReactivationResponse["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.every((d) => d.texts === 0 && d.replies === 0 && d.closes === 0)) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] text-sm text-[var(--text-muted)]">
        No texts sent in this range yet.
      </div>
    );
  }

  const width = 1000;
  const height = 260;
  const pad = { top: 16, right: 16, bottom: 28, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const ticks = 4;
  const step = Math.max(1, niceStep(Math.max(1, ...data.map((d) => d.texts)) / ticks));
  const max = step * ticks;
  const x = (i: number) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const path = (key: (typeof SERIES)[number]["key"]) =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`).join(" ");
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const colW = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const point = hover !== null ? data[hover] : null;

  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
        <span className="ml-auto text-[var(--text)]">
          {point
            ? `${point.date.slice(5)} · ${point.texts} texts · ${point.replies} replies · ${point.closes} closes`
            : "Hover a day for its numbers"}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Texts sent, replies and closes per day">
        {Array.from({ length: ticks + 1 }, (_, i) => step * i).map((v) => (
          <g key={v}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--panel-border)"
              strokeDasharray={v === 0 ? undefined : "3 3"}
            />
            <text x={pad.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--text-muted)">
              {v}
            </text>
          </g>
        ))}
        {hover !== null ? (
          <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--text-muted)" strokeWidth={1} />
        ) : null}
        {SERIES.map((s) => (
          <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
        ))}
        {point
          ? SERIES.map((s) => (
              <circle key={s.key} cx={x(hover!)} cy={y(point[s.key])} r={4} fill={s.color} stroke="#0b1224" strokeWidth={2} />
            ))
          : null}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text key={d.date} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
              {d.date.slice(5)}
            </text>
          ) : null
        )}
        {data.map((d, i) => (
          <rect
            key={`hit-${d.date}`}
            x={x(i) - colW / 2}
            y={pad.top}
            width={colW}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
    </div>
  );
}

function Thread({ offer, contactId }: { offer: ReactivationOffer; contactId: string }) {
  const { data } = useSWR<{ messages: { id: string; direction: "in" | "out"; body: string; at: string; touch: number | null }[] }>(
    `/api/${offer}/overview/reactivation/thread?contact=${encodeURIComponent(contactId)}`,
    (url: string) => fetch(url).then((r) => r.json())
  );
  if (!data) return <p className="px-5 py-3 text-sm text-[var(--text-muted)]">Loading thread…</p>;
  return (
    <div className="flex flex-col gap-2 bg-[var(--panel-subtle)] px-5 py-4">
      {data.messages.map((m) => (
        <div key={m.id} className={`flex flex-col ${m.direction === "out" ? "items-end" : "items-start"}`}>
          <div
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              m.direction === "out" ? "bg-sky-500/25 text-sky-50" : "bg-white/10 text-[var(--text-strong)]"
            }`}
          >
            {m.body}
          </div>
          <span className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            {timeFmt.format(new Date(m.at))}
            {m.direction === "out" && m.touch ? ` · text ${m.touch}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

type Controls = {
  engineOn: boolean;
  dailyCap: number;
  offReason: string;
  drafts: { id: string; leadName: string | null; body: string; touch: number | null }[];
};

function ControlsPanel({ offer }: { offer: ReactivationOffer }) {
  const { data, error, mutate } = useSWR<Controls>(`/api/${offer}/overview/reactivation/controls`, async (url: string) => {
    const res = await fetch(url);
    if (res.status === 401) throw new Error("locked");
    if (!res.ok) throw new Error("failed");
    return res.json();
  });
  const [cap, setCap] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/${offer}/overview/reactivation/controls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await mutate();
    setBusy(false);
  }

  const panel = "rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5";
  if (error?.message === "locked") {
    return (
      <div className={panel}>
        <p className="text-sm text-[var(--text-muted)]">
          Controls are behind the admin password.{" "}
          <a className="font-semibold text-sky-200 underline" href={`/${offer}/admin-team/unlock?next=/${offer}/reactivation`}>
            Unlock
          </a>
        </p>
      </div>
    );
  }
  if (!data) return <div className={`${panel} text-sm text-[var(--text-muted)]`}>Loading controls…</div>;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className={panel}>
        <div className="text-[13px] font-medium text-[var(--text-muted)]">Engine</div>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => send({ action: "toggle", on: !data.engineOn })}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 disabled:opacity-50 ${
              data.engineOn ? "bg-emerald-400/20 text-emerald-100 ring-emerald-300/40" : "bg-rose-400/15 text-rose-100 ring-rose-300/40"
            }`}
          >
            {data.engineOn ? "ON" : "OFF"}
          </button>
          <span className="text-xs text-[var(--text-muted)]">Click to turn {data.engineOn ? "off" : "on"}</span>
        </div>
        {!data.engineOn && data.offReason ? (
          <p className="mt-3 text-sm text-rose-200">Turned off: {data.offReason}</p>
        ) : null}
        <div className="mt-5 text-[13px] font-medium text-[var(--text-muted)]">Daily cap</div>
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (cap) send({ action: "cap", cap: Number(cap) }).then(() => setCap(""));
          }}
        >
          <input
            type="number"
            min={0}
            max={1000}
            value={cap}
            placeholder={String(data.dailyCap)}
            onChange={(e) => setCap(e.target.value)}
            className="w-24 rounded-md border border-[var(--panel-border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-sm text-[var(--text-strong)] outline-none"
          />
          <button
            type="submit"
            disabled={busy || !cap}
            className="rounded-md bg-sky-400/20 px-3 py-1.5 text-sm font-semibold text-sky-100 ring-1 ring-sky-300/40 disabled:opacity-50"
          >
            Save
          </button>
          <span className="text-xs text-[var(--text-muted)]">texts / day</span>
        </form>
      </div>

      <div className={`${panel} lg:col-span-2`}>
        <div className="text-[13px] font-medium text-[var(--text-muted)]">
          Drafts to approve <span className="text-[var(--text-strong)]">({data.drafts.length})</span>
        </div>
        {data.drafts.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Nothing waiting.</p>
        ) : (
          <ul className="mt-3 max-h-80 divide-y divide-[var(--panel-border)] overflow-y-auto">
            {data.drafts.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs text-[var(--text-muted)]">
                    {d.leadName ?? "Lead"}
                    {d.touch ? ` · text ${d.touch}` : " · reply"}
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--text-strong)]">{d.body}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => send({ action: "approve", id: d.id })}
                    className="rounded-md bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-300/40 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => send({ action: "reject", id: d.id })}
                    className="rounded-md bg-rose-400/15 px-3 py-1 text-xs font-semibold text-rose-100 ring-1 ring-rose-300/40 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ReactivationSection({ offer, range }: { offer: ReactivationOffer; range: RangeState }) {
  const { data } = useSectionData<ReactivationResponse>(`/api/${offer}/overview/reactivation`, range);
  const [open, setOpen] = useState<string | null>(null);
  const v = <T,>(value: T) => (data ? value : undefined);

  return (
    <div className="flex flex-col gap-4">
      <MetricGroups
        groups={[
          {
            title: "Outreach",
            metrics: [
              { label: "Leads Texted", value: v(data?.leadsTexted), format: "number", subtext: "Unique leads who got a text." },
              {
                label: "Reply Rate",
                value: v(data?.replyRate ?? null),
                format: "percent",
                subtext: data ? `${data.replies} replied ÷ leads texted. STOPs don't count.` : undefined,
              },
              {
                label: "Opt-out Rate",
                value: v(data?.optOutRate ?? null),
                format: "percent",
                status: data?.optOutRate != null ? (data.optOutRate > OPT_OUT_LIMIT ? "red" : "green") : null,
                subtext: data ? `${data.optOuts} STOPs ÷ leads texted. Over 3% means the text or list is off.` : undefined,
              },
            ],
          },
          {
            title: "Pipeline",
            metrics: [
              { label: "Calls Booked", value: v(data?.callsBooked), format: "number", subtext: "Leads who gave a time." },
              {
                label: "Closes",
                value: v(data?.closes),
                format: "number",
                subtext: data
                  ? `Affiliate PCN buyers texted before they bought${data.pendingCloses ? ` · ${data.pendingCloses} pending payment` : ""}.`
                  : undefined,
              },
              { label: "Conversion", value: v(data?.conversion ?? null), format: "percent", subtext: "Closes ÷ replies." },
            ],
          },
          {
            title: "Money",
            metrics: [
              { label: "Cash Collected", value: v(data?.cashCollected), format: "currency", subtext: "CPA cash from those closes." },
              { label: "AI Cost", value: v(data?.aiCost), format: "currency", subtext: "Every Claude call, summed." },
              {
                label: "ROI",
                value: v(data?.roi ?? null),
                format: "ratio",
                override: roiLabel(data?.roi ?? null),
                subtext: "Cash collected ÷ AI cost.",
              },
            ],
          },
        ]}
      />

      <DailyChart data={data?.daily ?? []} />

      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]">
        <div className="border-b border-[var(--panel-border)] bg-[var(--panel-subtle)] px-5 py-3 text-sm font-semibold text-[var(--text-strong)]">
          Closes by Touch
        </div>
        <div className="grid grid-cols-3 divide-x divide-[var(--panel-border)]">
          {(data?.byTouch ?? [1, 2, 3].map((touch) => ({ touch, closes: 0, cash: 0 }))).map((t) => (
            <div key={t.touch} className="px-5 py-4">
              <div className="text-[13px] font-medium text-[var(--text-muted)]">Text {t.touch}</div>
              <div className="mt-1 text-[28px] font-semibold leading-9 text-[var(--text-strong)]">{data ? t.closes : "—"}</div>
              <div className="text-xs text-[var(--text-muted)]">{data ? formatStatValue(t.cash, "currency") : ""}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]">
        <div className="border-b border-[var(--panel-border)] bg-[var(--panel-subtle)] px-5 py-3 text-sm font-semibold text-[var(--text-strong)]">
          Conversations
        </div>
        {data && data.conversations.length === 0 ? (
          <p className="px-5 py-4 text-sm text-[var(--text-muted)]">No conversations in this range.</p>
        ) : null}
        <ul className="max-h-[32rem] divide-y divide-[var(--panel-border)] overflow-y-auto">
          {data?.conversations.map((c) => (
            <li key={c.contactId}>
              <button
                type="button"
                onClick={() => setOpen(open === c.contactId ? null : c.contactId)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.03]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--text-strong)]">{c.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_STYLE[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{c.lastMessage}</p>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{timeFmt.format(new Date(c.lastAt))}</span>
              </button>
              {open === c.contactId ? <Thread offer={offer} contactId={c.contactId} /> : null}
            </li>
          ))}
        </ul>
      </div>

      <ControlsPanel offer={offer} />
    </div>
  );
}
