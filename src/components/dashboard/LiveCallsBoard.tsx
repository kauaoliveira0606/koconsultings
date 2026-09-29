"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { BUSINESS_TIME_ZONE, addDaysToDateString, easternDateString } from "@/lib/date-range";
import type { LiveCall, LiveCallsResponse } from "@/lib/calendly";

const REFRESH_MS = 30_000;

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed (${res.status})`);
  return res.json();
};

function time(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function dayAndTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function dayHeading(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDaysToDateString(today, 1)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${day}T12:00:00Z`));
}

const BADGE: Record<LiveCall["status"], { label: string; className: string }> = {
  live: { label: "Live Now", className: "bg-emerald-500 text-[#050912]" },
  scheduled: { label: "Booked", className: "bg-[var(--panel-subtle)] text-[var(--text-strong)]" },
  canceled: { label: "Canceled", className: "bg-red-500/20 text-red-300" },
  rescheduled: { label: "Rescheduled", className: "bg-amber-500/20 text-amber-300" },
};

function CallRow({ call }: { call: LiveCall }) {
  const off = call.status === "canceled" || call.status === "rescheduled";
  const badge = BADGE[call.status];
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 backdrop-blur-sm ${
        call.status === "live" ? "border-emerald-500/60" : ""
      } ${off ? "opacity-60" : ""}`}
    >
      <div className={`w-36 shrink-0 font-mono text-sm font-semibold text-[var(--text-strong)] ${off ? "line-through" : ""}`}>
        {time(call.start)} – {time(call.end)}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-semibold text-[var(--text-strong)] ${off ? "line-through" : ""}`}>
          {call.inviteeName ?? "Unknown invitee"}
        </div>
        <div className="truncate text-xs text-[var(--text-muted)]">
          {[call.inviteeEmail, call.eventName, call.host ? `with ${call.host}` : null]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {call.status === "rescheduled" ? (
          <div className="text-xs text-amber-300">
            Moved to {call.rescheduledTo ? `${dayAndTime(call.rescheduledTo)} ET` : "a new time"}
          </div>
        ) : null}
        {call.status === "canceled" ? (
          <div className="text-xs text-red-300">
            Canceled{call.canceledBy ? ` by ${call.canceledBy}` : ""}
            {call.cancelReason ? `: "${call.cancelReason}"` : ""}
          </div>
        ) : null}
        {call.rescheduledFrom && !off ? (
          <div className="text-xs text-amber-300">
            Rescheduled from {dayAndTime(call.rescheduledFrom)} ET
          </div>
        ) : null}
      </div>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
        {badge.label}
      </span>
    </div>
  );
}

/**
 * Every sales call on the calendar from now through the next week, grouped by
 * Eastern day. Re-polled every 30s; a call drops off as soon as it ends.
 */
export function LiveCallsBoard({ apiPath }: { apiPath: string }) {
  const { data, error } = useSWR<LiveCallsResponse>(apiPath, fetcher, {
    refreshInterval: REFRESH_MS,
  });

  // Re-render on a clock so ended calls disappear and "Live Now" flips on
  // time, even between polls.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const today = easternDateString(new Date(now));
  const calls = (data?.calls ?? [])
    .filter((c) => new Date(c.end).getTime() > now)
    .map((c) =>
      c.status === "scheduled" && new Date(c.start).getTime() <= now
        ? { ...c, status: "live" as const }
        : c
    );

  const byDay = new Map<string, LiveCall[]>();
  for (const c of calls) {
    const day = easternDateString(new Date(c.start));
    byDay.set(day, [...(byDay.get(day) ?? []), c]);
  }
  const todayCalls = byDay.get(today) ?? [];
  const count = (list: LiveCall[], ...statuses: LiveCall["status"][]) =>
    list.filter((c) => statuses.includes(c.status)).length;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Still To Go Today", value: count(todayCalls, "scheduled", "live") },
          { label: "Live Right Now", value: count(todayCalls, "live") },
          { label: "Canceled / Moved Today", value: count(todayCalls, "canceled", "rescheduled") },
          { label: "Booked Next 7 Days", value: count(calls, "scheduled", "live") },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {s.label}
            </div>
            <div className="mt-2 text-3xl font-bold text-[var(--text-strong)]">
              {data ? s.value : "…"}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 text-xs text-[var(--text-muted)]">
        {error && !data
          ? "Couldn't reach Calendly, retrying…"
          : data
            ? `Updated ${time(data.fetchedAt)} ET · refreshes every 30 seconds · all times Eastern`
            : "Loading…"}
      </div>

      {data && byDay.size === 0 ? (
        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 text-sm text-[var(--text-muted)]">
          No sales calls on the calendar for the next 7 days.
        </div>
      ) : null}

      {[...byDay.entries()].map(([day, list]) => (
        <section key={day} className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {dayHeading(day, today)} · {count(list, "scheduled", "live")} booked
          </h2>
          <div className="flex flex-col gap-2">
            {list.map((c) => (
              <CallRow key={c.id} call={c} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
