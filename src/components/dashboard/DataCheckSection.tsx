"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { useSectionData } from "@/lib/use-section-data";
import { formatDateTime, formatStatValue } from "@/lib/format";
import type { DataCheckDuplicate, DataCheckFlag, DataCheckResponse } from "@/lib/data-check";

const METRIC_LABELS: Record<DataCheckFlag["metric"], string> = {
  highTicket: "High Ticket Cash",
  lowTicket: "Low Ticket Cash",
};

type FlaggedDay = DataCheckFlag & { date: string };

/** Every flagged day for one log, rolled up into a single line. */
type Mismatch = {
  key: string;
  metric: DataCheckFlag["metric"];
  source: string;
  /** Cash the log has that the form doesn't. */
  missingFromForm: number;
  /** Cash the form has that the log doesn't. */
  missingFromLog: number;
  /** Newest first. */
  days: FlaggedDay[];
};

const money = (value: number) => formatStatValue(value, "currency");

/** What "the form" is called everywhere on this panel. */
const FORM = "Daily Metrics form";

/** Cash on the form with nothing behind it in a log: why that matters for that log. */
function missingFromLogNote(source: string): string {
  if (/post call/i.test(source)) {
    return " No closer or setter commission is calculated on that cash until its post call note (or follow up payment) is in.";
  }
  if (/affiliate pcn/i.test(source)) {
    return " Those sales have no Affiliate PCN entry, so they are missing from the reps' logged low ticket.";
  }
  return " The reps' end of day reports don't account for it.";
}

function formatDay(date: string, weekday = false): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: weekday ? "short" : undefined,
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function groupMismatches(data: DataCheckResponse): Mismatch[] {
  const groups = new Map<string, Mismatch>();
  for (const day of data.days) {
    for (const flag of day.flags) {
      const key = `${flag.metric}-${flag.source}`;
      const group = groups.get(key) ?? {
        key,
        metric: flag.metric,
        source: flag.source,
        missingFromForm: 0,
        missingFromLog: 0,
        days: [],
      };
      groups.set(key, group);
      if (flag.diff > 0) group.missingFromForm += flag.diff;
      else group.missingFromLog -= flag.diff;
      group.days.push({ ...flag, date: day.date });
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.missingFromForm + b.missingFromLog - (a.missingFromForm + a.missingFromLog)
  );
}

function period(days: FlaggedDay[]): string {
  const newest = days[0].date;
  const oldest = days[days.length - 1].date;
  if (newest === oldest) return `Around ${formatDay(newest)}`;
  return `${formatDay(oldest)} to ${formatDay(newest)} · ${days.length} days`;
}

function MismatchRow({ mismatch }: { mismatch: Mismatch }) {
  const parts: string[] = [];
  if (mismatch.missingFromForm > 0) {
    parts.push(`has ${money(mismatch.missingFromForm)} that is not on the ${FORM}`);
  }
  if (mismatch.missingFromLog > 0) {
    parts.push(`is missing ${money(mismatch.missingFromLog)} that is on the ${FORM}`);
  }
  return (
    <details className="group rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <div className="text-sm text-[var(--text-strong)]">
          <span className="font-semibold">{METRIC_LABELS[mismatch.metric]}:</span> {mismatch.source}{" "}
          <span className="font-semibold text-red-400">{parts.join(" and ")}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          {period(mismatch.days)}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className="transition-transform group-open:rotate-180"
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </summary>
      <div className="space-y-1 border-t border-[var(--panel-border)] px-3 py-2 text-xs text-[var(--text-muted)]">
        {mismatch.missingFromForm > 0 ? (
          <p>
            <span className="font-semibold text-red-400">{money(mismatch.missingFromForm)}</span>{" "}
            was logged in {mismatch.source} but never entered on the {FORM}. The dashboard&apos;s
            cash (Overview, ROAS, Agency profit) is short by that much until the form is corrected.
          </p>
        ) : null}
        {mismatch.missingFromLog > 0 ? (
          <p>
            <span className="font-semibold text-amber-400">{money(mismatch.missingFromLog)}</span>{" "}
            is on the {FORM} with nothing in {mismatch.source} to back it up.
            {missingFromLogNote(mismatch.source)}
          </p>
        ) : null}
      </div>
      <ul className="divide-y divide-[var(--panel-border)] border-t border-[var(--panel-border)] px-3">
        {mismatch.days.map((day) => (
          <li key={day.date} className="py-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
              <div className="text-[var(--text-strong)]">
                <span className="font-semibold">{formatDay(day.date, true)}:</span> {mismatch.source}{" "}
                {money(day.sourceCash)}, {FORM}{" "}
                {day.formCash === null ? "has no entry for this day" : money(day.formCash)}
              </div>
              <div className={`font-semibold ${day.diff > 0 ? "text-red-400" : "text-amber-400"}`}>
                {day.diff > 0
                  ? `${money(day.diff)} not on the form`
                  : `${money(-day.diff)} not in this log`}
              </div>
            </div>
            {day.hint ? (
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">{day.hint}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function duplicateLine(d: DataCheckDuplicate): string {
  const times = d.count === 2 ? "twice" : `${d.count} times`;
  if (d.who === null) {
    return `${d.count} entries for ${formatDay(d.date, true)}. They are added together, so that day's numbers are inflated if one is a resubmission.`;
  }
  if (d.cash === null) {
    return `${d.who} submitted ${times} for ${formatDay(d.date, true)}.`;
  }
  return (
    `${d.who} was logged ${times} on ${formatDay(d.date, true)}` +
    (d.cash > 0 ? `, ${money(d.cash)} each. ${money(d.extraCash)} is counted more than once.` : ", no cash.")
  );
}

/** One copy of a repeated record: when it came in, a link to it, and everything on it. */
function DuplicateCopy({ record, index }: { record: DataCheckDuplicate["records"][number]; index: number }) {
  return (
    <div className="rounded border border-[var(--panel-border)] px-2.5 py-2">
      <div className="text-xs text-[var(--text-strong)]">
        <span className="font-semibold">Copy {index + 1}</span>
        {record.submittedAt ? ` · submitted ${formatDateTime(record.submittedAt)}` : ""}
        {record.url ? (
          <>
            {" · "}
            <a
              href={record.url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-[var(--text-strong)]"
            >
              Open in Airtable
            </a>
          </>
        ) : null}
      </div>
      {record.fields && record.fields.length > 0 ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)]">
            Show everything on this copy ({record.fields.length} fields)
          </summary>
          <dl className="mt-1.5 space-y-1 text-xs">
            {record.fields.map((f) => (
              <div key={f.name} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
                <dt className="text-[var(--text-muted)]">{f.name}</dt>
                <dd className="break-words text-[var(--text-strong)]">{f.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  );
}

/** Where the copies disagree, so it is clear which one to keep. */
function DuplicateDifferences({ duplicate }: { duplicate: DataCheckDuplicate }) {
  if (!duplicate.differences) return null;
  if (duplicate.differences.length === 0) {
    return (
      <div className="mt-1.5 text-xs text-[var(--text-muted)]">
        <span className="font-semibold text-[var(--text-strong)]">The copies are identical</span> in
        every field, so either one can be deleted.
      </div>
    );
  }
  return (
    <div className="mt-1.5">
      <div className="text-xs font-semibold text-[var(--text-strong)]">
        What is different between the copies ({duplicate.differences.length} field
        {duplicate.differences.length === 1 ? "" : "s"}):
      </div>
      <ul className="mt-1 space-y-1 text-xs">
        {duplicate.differences.map((diff) => (
          <li key={diff.field}>
            <span className="text-[var(--text-muted)]">{diff.field}:</span>{" "}
            {diff.values.map((value, i) => (
              <span key={i} className="text-[var(--text-strong)]">
                {i > 0 ? <span className="text-[var(--text-muted)]"> · </span> : null}
                <span className="text-[var(--text-muted)]">Copy {i + 1}:</span>{" "}
                <span className="font-semibold">{value}</span>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Records submitted more than once in a log. Always shown, even when there are none.
 * "Mark as done" takes one off the list (it is remembered in the "Data Check Done"
 * table); it never touches the log itself.
 */
function Duplicates({
  duplicates,
  doneDuplicates,
  apiPath,
}: {
  duplicates: DataCheckDuplicate[];
  doneDuplicates: DataCheckDuplicate[];
  apiPath: string;
}) {
  const { mutate } = useSWRConfig();
  // Keys moved by a click that the next refresh hasn't caught up with yet.
  const [justDone, setJustDone] = useState<Set<string>>(new Set());
  const [justRestored, setJustRestored] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<string | null>(null);

  const open = [
    ...duplicates.filter((d) => !justDone.has(d.key)),
    ...doneDuplicates.filter((d) => justRestored.has(d.key)),
  ];
  const done = [
    ...doneDuplicates.filter((d) => !justRestored.has(d.key)),
    ...duplicates.filter((d) => justDone.has(d.key)),
  ];
  const extraCash = open.reduce((sum, d) => sum + d.extraCash, 0);

  async function setDone(d: DataCheckDuplicate, isDone: boolean) {
    setFailed(null);
    const move = (set: Set<string>, add: boolean) => {
      const next = new Set(set);
      if (add) next.add(d.key);
      else next.delete(d.key);
      return next;
    };
    setJustDone((set) => move(set, isDone));
    setJustRestored((set) => move(set, !isDone));
    try {
      const res = await fetch(`${apiPath}/done`, {
        method: isDone ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: d.key, source: d.source, who: d.who ?? "", date: d.date }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await mutate((key) => typeof key === "string" && key.startsWith(apiPath));
    } catch {
      // Put it back where it was and say so.
      setJustDone((set) => move(set, false));
      setJustRestored((set) => move(set, false));
      setFailed("Couldn't save that. Try again.");
    }
  }

  const doneList =
    done.length > 0 ? (
      <details className="border-t border-[var(--panel-border)] px-3 py-2">
        <summary className="cursor-pointer text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)]">
          Marked as done ({done.length})
        </summary>
        <ul className="mt-1.5 space-y-1.5">
          {done.map((d) => (
            <li key={d.key} className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-[var(--text-muted)]">
              <span>
                <span className="font-semibold">{d.source}:</span> {duplicateLine(d)}
              </span>
              <button
                type="button"
                onClick={() => setDone(d, false)}
                className="underline underline-offset-2 hover:text-[var(--text-strong)]"
              >
                Put back on the list
              </button>
            </li>
          ))}
        </ul>
      </details>
    ) : null;

  if (open.length === 0) {
    return (
      <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] text-sm text-[var(--text-strong)]">
        <div className="px-3 py-2.5">
          <span className="font-semibold">Duplicate records:</span>{" "}
          <span className="font-semibold text-emerald-400">none{done.length > 0 ? " left to look at" : ""}</span>
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">
            Checks every log for the same lead, day and cash submitted twice, and for a rep
            submitting two end of day reports for one day. All time, not tied to the date filter.
          </div>
          {failed ? <div className="mt-1 text-xs text-red-400">{failed}</div> : null}
        </div>
        {doneList}
      </div>
    );
  }

  return (
    <details className="group rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)]" open>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <div className="text-sm text-[var(--text-strong)]">
          <span className="font-semibold">Duplicate records:</span>{" "}
          <span className="font-semibold text-red-400">
            {open.length} record{open.length === 1 ? "" : "s"} submitted more than once
            {extraCash > 0 ? `, ${money(extraCash)} counted more than once` : ""}
          </span>
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">
            All time, not tied to the date filter. Newest first.
          </div>
        </div>
      </summary>
      <p className="border-t border-[var(--panel-border)] px-3 py-2 text-xs text-[var(--text-muted)]">
        Same lead, same day and same cash in one log (or the same rep&apos;s end of day report
        twice). Each one shows when every copy was submitted, what is different between the
        copies, and everything on each copy, with a link to open it in Airtable and delete the
        extra one. Duplicates are not removed automatically: a repeated post call note or follow
        up payment pays its commission twice until the extra record is deleted. When you have
        dealt with one, press <span className="font-semibold text-[var(--text-strong)]">Mark as done</span>{" "}
        to take it off this list. That only hides it here; it changes nothing in Airtable.
      </p>
      {failed ? <div className="px-3 pb-2 text-xs text-red-400">{failed}</div> : null}
      <ul className="divide-y divide-[var(--panel-border)] border-t border-[var(--panel-border)] px-3">
        {open.map((d) => (
          <li key={d.key} className="py-3 text-sm text-[var(--text-strong)]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="font-semibold">{d.source}:</span> {duplicateLine(d)}
                <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Where: Airtable, {d.source} table
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDone(d, true)}
                className="shrink-0 rounded-md border border-[var(--panel-border)] px-2.5 py-1 text-xs font-semibold text-[var(--text-strong)] hover:border-emerald-400 hover:text-emerald-400"
              >
                Mark as done
              </button>
            </div>
            <DuplicateDifferences duplicate={d} />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {d.records.map((record, i) => (
                <DuplicateCopy key={record.id} record={record} index={i} />
              ))}
            </div>
          </li>
        ))}
      </ul>
      {doneList}
    </details>
  );
}

/**
 * Says which team logs (Post Call Notes, Follow Up Payment, EOD Closer,
 * Affiliate PCN, Affiliate EOD) don't match the Marketing Daily Metrics form
 * on cash for the selected range, by how much and roughly when. Each line
 * opens into the day-by-day detail.
 */
export function DataCheckSection({ apiPath, range }: { apiPath: string; range: RangeState }) {
  const { data, error } = useSectionData<DataCheckResponse>(apiPath, range);

  if (!data) {
    return (
      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-sm text-[var(--text-muted)] backdrop-blur-sm">
        {error ? "Couldn't load, retrying…" : "Checking the logs against the form…"}
      </div>
    );
  }

  if (data.flagCount === 0) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-[var(--text-strong)] backdrop-blur-sm">
        <span className="font-semibold text-emerald-400">All clear.</span> The cash the reps logged
        (post call notes, follow up payments, end of day reports, Affiliate PCN) matches the
        Marketing Daily Metrics form, the once a day numbers entry this dashboard is built from,
        for this range (checked through {formatDay(data.checkedThrough)}).
        <div className="mt-3">
          <Duplicates duplicates={data.duplicates} doneDuplicates={data.doneDuplicates ?? []} apiPath={apiPath} />
        </div>
      </div>
    );
  }

  const mismatches = groupMismatches(data);
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-red-400">
          {mismatches.length > 0
            ? `Cash isn't matching in ${mismatches.length} place${mismatches.length === 1 ? "" : "s"}`
            : "Cash matches"}
          {data.duplicates.length > 0
            ? ` · ${data.duplicates.length} duplicate record${data.duplicates.length === 1 ? "" : "s"}`
            : ""}
        </div>
        <div className="text-xs text-[var(--text-muted)]">Click a line for the days.</div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
        <span className="font-semibold text-[var(--text-strong)]">What this compares.</span> The{" "}
        <span className="font-semibold text-[var(--text-strong)]">{FORM}</span>{" "}
        is the Marketing
        Daily Metrics form in Airtable: the one entry per day with that day&apos;s ad spend, calls
        and cash. Every cash number on this dashboard (Overview, ROAS, Agency profit) comes from
        it. The reps log the same cash a second time in their own forms: post call notes, follow
        up payments, end of day reports and Affiliate PCN. Both should add up to the same dollars.
        Each line below is a rep log that doesn&apos;t, and by how much. Cash that lands a day or
        two apart is already matched up and not flagged.
      </p>
      <div className="mt-3 space-y-2">
        <Duplicates duplicates={data.duplicates} doneDuplicates={data.doneDuplicates ?? []} apiPath={apiPath} />
        {mismatches.map((mismatch) => (
          <MismatchRow key={mismatch.key} mismatch={mismatch} />
        ))}
      </div>
    </div>
  );
}
