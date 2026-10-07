import { formatStatValue, type StatFormat } from "@/lib/format";

export type LeaderboardRow = {
  label: string;
  value: number | null | undefined;
  format: StatFormat;
  /** Shown instead of the formatted value (e.g. a duration). */
  text?: string;
  note?: string;
  /** KPI check against a target: green = hitting it, red = missing it. */
  status?: "green" | "red" | null;
  goal?: string;
};

export type LeaderboardEntry = {
  name: string;
  /** The one number the board is ranked on. */
  hero: { label: string; value: number | null | undefined; format: StatFormat };
  sub?: string;
  groups: { title: string; rows: LeaderboardRow[] }[];
};

const MEDALS = ["🥇", "🥈", "🥉"];

const STATUS_TEXT = { green: "text-emerald-400", red: "text-red-400" } as const;
const STATUS_DOT = { green: "bg-emerald-400", red: "bg-red-400" } as const;

/** Green when the value is on the right side of its target, red when not, nothing without data. */
export function kpi(
  value: number | null | undefined,
  target: number | null | undefined,
  direction: "atLeast" | "under"
): "green" | "red" | null {
  if (value === null || value === undefined || target === null || target === undefined) return null;
  return (direction === "atLeast" ? value >= target : value < target) ? "green" : "red";
}

function Rows({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <dl className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3">
          <dt className="min-w-0 text-sm text-[var(--text-muted)]">
            {row.label}
            {row.note || row.goal ? (
              <span className="block text-xs opacity-70">
                {[row.goal ? `Goal ${row.goal}` : null, row.note].filter(Boolean).join(" · ")}
              </span>
            ) : null}
          </dt>
          <dd
            className={`flex shrink-0 items-center gap-1.5 text-sm font-semibold ${
              row.status ? STATUS_TEXT[row.status] : "text-[var(--text-strong)]"
            }`}
          >
            {row.status ? (
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[row.status]}`} aria-hidden="true" />
            ) : null}
            {row.text ?? formatStatValue(row.value, row.format)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Card({ entry, rank }: { entry: LeaderboardEntry; rank: number | null }) {
  return (
    <div
      className={`flex flex-col rounded-lg border bg-[var(--panel-bg)] backdrop-blur-sm ${
        rank === 0 ? "border-amber-400/60" : "border-[var(--panel-border)]"
      }`}
    >
      <div className="border-b border-[var(--panel-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          {rank !== null ? (
            <span className="text-xl" aria-label={`Rank ${rank + 1}`}>
              {MEDALS[rank] ?? `#${rank + 1}`}
            </span>
          ) : null}
          <span className="truncate text-lg font-bold text-[var(--text-strong)]">{entry.name}</span>
        </div>
        <div className="mt-3 text-4xl font-bold text-[var(--text-strong)]">
          {formatStatValue(entry.hero.value, entry.hero.format)}
        </div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {entry.hero.label}
        </div>
        {entry.sub ? <div className="mt-1 text-xs text-[var(--text-muted)]">{entry.sub}</div> : null}
      </div>
      <div className="flex-1 divide-y divide-[var(--panel-border)]">
        {entry.groups.map((group) => (
          <div key={group.title} className="px-5 py-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-strong)]">
              {group.title}
            </div>
            <Rows rows={group.rows} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A leaderboard as one card per person, best first: name and medal, the
 * number they are ranked on in big type, then their other stats in small
 * titled groups. The team's totals sit in a card of their own at the end.
 */
export function LeaderboardCards({
  entries,
  team,
  emptyText,
  footnote,
}: {
  entries: LeaderboardEntry[] | undefined;
  team?: LeaderboardEntry;
  emptyText: string;
  footnote: string;
}) {
  if (!entries) return <p className="text-sm text-[var(--text-muted)]">Loading...</p>;
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-sm text-[var(--text-muted)] backdrop-blur-sm">
        {emptyText}
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {entries.map((entry, i) => (
          <Card key={entry.name} entry={entry} rank={i} />
        ))}
        {team && entries.length > 1 ? <Card entry={team} rank={null} /> : null}
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">{footnote}</p>
    </div>
  );
}
