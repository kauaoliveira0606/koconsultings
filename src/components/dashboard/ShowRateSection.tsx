"use client";

import { useState } from "react";
import useSWR from "swr";
import { MetricGroups } from "@/components/dashboard/MetricGroups";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue } from "@/lib/format";
import type { ShowRateOutcome, ShowRateResponse, ShowRateStatus } from "@/lib/show-rate";

// Solid, readable pills on the light theme.
const STATUS_STYLE: Record<ShowRateStatus, string> = {
  Registered: "bg-slate-100 text-slate-700",
  Replied: "bg-sky-100 text-sky-800",
  Committed: "bg-emerald-100 text-emerald-800",
  "Can't make it": "bg-amber-100 text-amber-800",
  "Opted out": "bg-rose-100 text-rose-800",
};

const OUTCOME_STYLE: Record<ShowRateOutcome, string> = {
  Pending: "bg-slate-100 text-slate-600",
  Showed: "bg-emerald-600 text-white",
  "No show": "bg-rose-600 text-white",
};

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const sessionFmt = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

const pct = (v: number | null) => (v == null ? "—" : formatStatValue(v, "percent"));
const panel = "overflow-hidden rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]";
const panelTitle = "border-b border-[var(--panel-border)] bg-[var(--panel-subtle)] px-5 py-3 text-sm font-semibold text-[var(--text-strong)]";

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;
}

function Thread({ contactId }: { contactId: string }) {
  const { data } = useSWR<{ messages: { id: string; direction: "in" | "out"; body: string; at: string; touch: number | null }[] }>(
    `/api/bronson/show-rate/thread?contact=${encodeURIComponent(contactId)}`,
    (url: string) => fetch(url).then((r) => r.json())
  );
  if (!data) return <p className="px-5 py-3 text-sm text-[var(--text-muted)]">Loading thread…</p>;
  return (
    <div className="flex flex-col gap-2 bg-[var(--panel-subtle)] px-5 py-4">
      {data.messages.map((m) => (
        <div key={m.id} className={`flex flex-col ${m.direction === "out" ? "items-end" : "items-start"}`}>
          <div
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              m.direction === "out" ? "bg-sky-600 text-white" : "bg-[var(--panel-bg)] text-[var(--text-strong)] ring-1 ring-[var(--panel-border)]"
            }`}
          >
            {m.body}
          </div>
          <span className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            {timeFmt.format(new Date(m.at))}
            {m.direction === "out" && m.touch ? " · 4pm check-in" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function EngineSwitch() {
  const { data, error, mutate } = useSWR<{ engineOn: boolean }>("/api/bronson/show-rate/controls", async (url: string) => {
    const res = await fetch(url);
    if (res.status === 401) throw new Error("locked");
    if (!res.ok) throw new Error("failed");
    return res.json();
  });
  const [busy, setBusy] = useState(false);

  async function toggle(on: boolean) {
    setBusy(true);
    await fetch("/api/bronson/show-rate/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", on }),
    });
    await mutate();
    setBusy(false);
  }

  const box = "rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5";
  if (error?.message === "locked") {
    return (
      <div className={box}>
        <p className="text-sm text-[var(--text-muted)]">
          The engine switch is behind the admin password.{" "}
          <a className="font-semibold text-sky-700 underline" href="/bronson/admin-team/unlock?next=/bronson/show-rate">
            Unlock
          </a>
        </p>
      </div>
    );
  }
  if (!data) return <div className={`${box} text-sm text-[var(--text-muted)]`}>Loading engine switch…</div>;
  return (
    <div className={`${box} flex flex-wrap items-center gap-3`}>
      <span className="text-[13px] font-medium text-[var(--text-muted)]">Engine</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => toggle(!data.engineOn)}
        className={`rounded-full px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${data.engineOn ? "bg-emerald-600" : "bg-rose-600"}`}
      >
        {data.engineOn ? "ON" : "OFF"}
      </button>
      <span className="text-xs text-[var(--text-muted)]">
        ON: answers every registrant&apos;s text as Bronson and sends the 4pm check-in on event day.
      </span>
    </div>
  );
}

export function ShowRateSection({ range }: { range: RangeState }) {
  const { data } = useSectionData<ShowRateResponse>("/api/bronson/show-rate", range);
  const [open, setOpen] = useState<string | null>(null);
  const v = <T,>(value: T) => (data ? value : undefined);

  return (
    <div className="flex flex-col gap-4">
      <EngineSwitch />

      <MetricGroups
        groups={[
          {
            title: "Registrants",
            metrics: [
              { label: "Registered", value: v(data?.registrants), format: "number", subtext: "People registered for the sessions in this range." },
              {
                label: "Reply Rate",
                value: v(data?.replyRate ?? null),
                format: "percent",
                subtext: data ? `${data.replied} texted back ÷ registered.` : undefined,
              },
              {
                label: "4pm Check-ins Sent",
                value: v(data?.checkIns),
                format: "number",
                subtext: data ? `To people who never replied · ${data.optOuts} opted out.` : undefined,
              },
            ],
          },
          {
            title: "Commitment",
            metrics: [
              {
                label: "Committed",
                value: v(data?.committed),
                format: "number",
                subtext: data ? `Said they'll be there live · ${pct(data.commitRate)} of registered.` : undefined,
              },
              { label: "AI Cost", value: v(data?.aiCost), format: "currency", subtext: "Every Claude call, summed." },
            ],
          },
          {
            title: "Show Rate",
            metrics: [
              {
                label: "Show Rate",
                value: v(data?.showRate ?? null),
                format: "percent",
                subtext: data ? `${data.showed} showed ÷ ${data.decided} registrants of finished sessions.` : undefined,
              },
              {
                label: "Show Rate: Committed",
                value: v(data?.committedShowRate ?? null),
                format: "percent",
                subtext: data ? `Everyone else: ${pct(data.otherShowRate)}.` : undefined,
              },
            ],
          },
        ]}
      />

      <div className={panel}>
        <div className={panelTitle}>By Session</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-[12px] text-[var(--text-muted)]">
              <tr className="border-b border-[var(--panel-border)]">
                {["Session", "Registered", "Replied", "Committed", "Showed", "No show", "Pending", "Show rate"].map((h) => (
                  <th key={h} className="px-5 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--panel-border)] text-[var(--text-strong)]">
              {data?.bySession.map((r) => (
                <tr key={r.session}>
                  <td className="px-5 py-2.5 font-semibold">{sessionFmt(r.session)}</td>
                  <td className="px-5 py-2.5">{r.registrants}</td>
                  <td className="px-5 py-2.5">{r.replied}</td>
                  <td className="px-5 py-2.5">{r.committed}</td>
                  <td className="px-5 py-2.5">{r.showed}</td>
                  <td className="px-5 py-2.5">{r.noShow}</td>
                  <td className="px-5 py-2.5">{r.pending}</td>
                  <td className="px-5 py-2.5 font-semibold">{pct(r.showRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.bySession.length === 0 ? <p className="px-5 py-4 text-sm text-[var(--text-muted)]">No sessions in this range.</p> : null}
        </div>
      </div>

      <div className={panel}>
        <div className={panelTitle}>Registrant Feedback</div>
        {data && data.feedback.length === 0 ? (
          <p className="px-5 py-4 text-sm text-[var(--text-muted)]">No feedback yet. It fills in as registrants text back.</p>
        ) : null}
        <ul className="max-h-[32rem] divide-y divide-[var(--panel-border)] overflow-y-auto">
          {data?.feedback.map((f) => (
            <li key={`${f.contactId}-${f.session}`} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-strong)]">{f.name}</span>
                <Pill className={STATUS_STYLE[f.status]}>{f.status}</Pill>
                <span className="text-[11px] text-[var(--text-muted)]">{sessionFmt(f.session)} session</span>
              </div>
              <dl className="mt-1.5 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                {(
                  [
                    ["Goal", f.goal],
                    ["Wants covered", f.wantsCovered],
                    ["Better time", f.preferredTime],
                    ["Other", f.other],
                  ] as const
                )
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label} className="contents">
                      <dt className="text-[12px] font-medium text-[var(--text-muted)]">{label}</dt>
                      <dd className="whitespace-pre-line text-[var(--text-strong)]">{value}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>

      <div className={panel}>
        <div className={panelTitle}>Questions to Review</div>
        <p className="border-b border-[var(--panel-border)] px-5 py-2 text-xs text-[var(--text-muted)]">
          Real questions the bot had no trained answer for. Approve or fix the answer and it gets added to the voice.
        </p>
        {data && data.questions.length === 0 ? (
          <p className="px-5 py-4 text-sm text-[var(--text-muted)]">Nothing to review yet.</p>
        ) : null}
        <ul className="max-h-[24rem] divide-y divide-[var(--panel-border)] overflow-y-auto">
          {data?.questions.map((q, i) => (
            <li key={`${q.contactId}-${i}`} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-strong)]">{q.name}</span>
                <span className="text-[11px] text-[var(--text-muted)]">{sessionFmt(q.session)} session</span>
              </div>
              <p className="mt-1 text-sm text-[var(--text-strong)]">{q.note}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className={panel}>
        <div className={panelTitle}>Conversations</div>
        {data && data.conversations.length === 0 ? (
          <p className="px-5 py-4 text-sm text-[var(--text-muted)]">No conversations in this range yet.</p>
        ) : null}
        <ul className="max-h-[32rem] divide-y divide-[var(--panel-border)] overflow-y-auto">
          {data?.conversations.map((c) => (
            <li key={c.contactId}>
              <button
                type="button"
                onClick={() => setOpen(open === c.contactId ? null : c.contactId)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-[var(--panel-subtle)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--text-strong)]">{c.name}</span>
                    <Pill className={STATUS_STYLE[c.status]}>{c.status}</Pill>
                    <Pill className={OUTCOME_STYLE[c.outcome]}>{c.outcome}</Pill>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{c.lastMessage}</p>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{c.lastAt ? timeFmt.format(new Date(c.lastAt)) : ""}</span>
              </button>
              {open === c.contactId ? <Thread contactId={c.contactId} /> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
