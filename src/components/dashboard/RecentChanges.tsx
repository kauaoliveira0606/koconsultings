"use client";

import { useState } from "react";
import useSWR from "swr";
import { addDaysToDateString, easternDateString } from "@/lib/date-range";

type RecentChangesResponse = {
  days: { date: string; changesMadeToday: string }[];
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed (${res.status})`);
  return res.json();
};

/**
 * Overview "Recent Changes": the team writes each day's "changes made" note
 * right here (saved to the offer's "Dashboard Changes" Airtable table) instead
 * of through the Marketing Daily Metrics form. Picking a date loads that
 * day's existing note so it can be edited; saving an empty note removes it.
 */
export function RecentChanges({ apiPath }: { apiPath: string }) {
  const { data, mutate } = useSWR<RecentChangesResponse>(apiPath, fetcher);
  // The team always logs the day before, once it's fully finished.
  const [date, setDate] = useState(() => addDaysToDateString(easternDateString(), -1));
  // null = untouched, so the editor shows the chosen day's saved note.
  const [edit, setEdit] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const savedNote = data?.days.find((d) => d.date === date)?.changesMadeToday ?? "";
  const draft = edit ?? savedNote;

  function pickDate(next: string) {
    setDate(next);
    setEdit(null);
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, changes: draft }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await mutate();
      setEdit(null);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const dirty = draft.trim() !== savedNote.trim();

  return (
    <>
      <div className="mb-4 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
          <label htmlFor="changes-date">Changes made on</label>
          <input
            id="changes-date"
            type="date"
            value={date}
            max={easternDateString()}
            onChange={(e) => pickDate(e.target.value)}
            className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1 text-[var(--text)]"
          />
        </div>
        <textarea
          value={draft}
          onChange={(e) => {
            setEdit(e.target.value);
            setStatus("idle");
          }}
          rows={4}
          placeholder="What changed that day? (new ad, page edit, script update, price test...)"
          className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)]"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={status === "saving" || !dirty}
            className="rounded-md bg-[var(--btn-active-bg)] px-3 py-1.5 text-sm font-medium text-[var(--btn-active-fg)] disabled:opacity-40"
          >
            {status === "saving" ? "Saving..." : "Save"}
          </button>
          {status === "saved" && !dirty && (
            <span className="text-sm text-[var(--text-muted)]">Saved.</span>
          )}
          {status === "error" && (
            <span className="text-sm text-[var(--cell-red-text)]">Couldn&apos;t save, try again.</span>
          )}
        </div>
      </div>

      {data && data.days.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.days.map((day) => (
            <div
              key={day.date}
              className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm"
            >
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase text-[var(--text-muted)]">
                <span>{day.date}</span>
                <button
                  type="button"
                  onClick={() => pickDate(day.date)}
                  className="font-medium normal-case underline-offset-2 hover:underline"
                >
                  Edit
                </button>
              </div>
              <p className="whitespace-pre-wrap border-l-2 border-[var(--accent)] pl-3 text-sm text-[var(--text-strong)]">
                {day.changesMadeToday}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-sm text-[var(--text-muted)] backdrop-blur-sm">
          No changes logged in the last 14 days.
        </div>
      )}
    </>
  );
}
