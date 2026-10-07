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
  /**
   * Which way wins this row's #1 medal across the board. Defaults to "high"
   * (the biggest number wins); "low" for rates where smaller is better.
   */
  best?: "high" | "low";
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

/** "Funnel|Calls" -> the winning value for that row among everyone on the board. */
type Winners = Map<string, number>;

const rowKey = (group: string, label: string) => `${group}|${label}`;

/**
 * The best value on every row, so whoever holds it gets a #1 medal on that
 * line. Needs at least two people, ignores blanks and zeros, and a tie gives
 * the medal to everyone tied.
 */
function findWinners(entries: LeaderboardEntry[]): Winners {
  const winners: Winners = new Map();
  if (entries.length < 2) return winners;
  for (const group of entries[0].groups) {
    for (const row of group.rows) {
      const key = rowKey(group.title, row.label);
      const values = entries
        .map((e) => e.groups.find((g) => g.title === group.title)?.rows.find((r) => r.label === row.label)?.value)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      // A "low is better" row still needs someone to have a real figure above zero to beat.
      const ranked = row.best === "low" ? values : values.filter((v) => v > 0);
      if (ranked.length === 0 || (row.best === "low" && values.length < 2)) continue;
      winners.set(key, row.best === "low" ? Math.min(...ranked) : Math.max(...ranked));
    }
  }
  return winners;
}

function Rows({ group, rows, winners }: { group: string; rows: LeaderboardRow[]; winners?: Winners }) {
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
            {winners && typeof row.value === "number" && winners.get(rowKey(group, row.label)) === row.value ? (
              <span title={`#1 on ${row.label}`} aria-label={`Number 1 on ${row.label}`}>
                🥇
              </span>
            ) : null}
            {row.text ?? formatStatValue(row.value, row.format)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Card({
  entry,
  rank,
  winners,
}: {
  entry: LeaderboardEntry;
  rank: number | null;
  winners?: Winners;
}) {
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
            <Rows group={group.title} rows={group.rows} winners={winners} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A leaderboard as one card per person, best first: name and medal, the
 * number they are ranked on in big type, then their other stats in small
 * titled groups. Whoever is #1 on any single line gets a medal on that line. The team's totals sit in a card of their own at the end.
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
  const winners = findWinners(entries);
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {entries.map((entry, i) => (
          <Card key={entry.name} entry={entry} rank={i} winners={winners} />
        ))}
        {team && entries.length > 1 ? <Card entry={team} rank={null} /> : null}
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">{footnote}</p>
    </div>
  );
}
