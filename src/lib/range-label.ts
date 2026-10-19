import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { easternDateString, resolveRange } from "@/lib/date-range";

const md = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}`;

/**
 * "10/14 → 10/19" for the hero cards' pill: the selected range, ending no
 * later than today and starting no earlier than `floor` (e.g. a funnel's
 * launch). "All Time" with no floor reads "All Time".
 */
export function rangePeriodLabel(range: RangeState, floor?: string | null): string | null {
  const resolved = resolveRange(
    range.preset,
    range.customStart && range.customEnd ? { start: range.customStart, end: range.customEnd } : undefined,
  );
  const today = easternDateString();
  const from = [resolved.start, floor].filter((d): d is string => !!d).sort().pop();
  if (!from) return "All Time";
  const to = [resolved.end ?? today, today].sort()[0];
  if (from > to) return null;
  return from === to ? md(from) : `${md(from)} → ${md(to)}`;
}
