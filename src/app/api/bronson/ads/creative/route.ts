import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { aggregateEntities, getAdsDaily, getAdsRange } from "@/lib/ads-cortana";
import { nextBatchBrief, scoreCreatives } from "@/lib/creative-score";
import { addTask, AI_ASSIGNEE } from "@/lib/office";

export const dynamic = "force-dynamic";

async function scoresFor(request: NextRequest) {
  const preset = request.nextUrl.searchParams.get("preset") ?? "last_7_days";
  const range = parseRangeFromRequest(request);
  const rangeRows = await getAdsRange(preset);
  const rows = rangeRows ?? (await getAdsDaily()).filter((r) => isDateInRange(r.date, range));
  return { preset, scores: scoreCreatives(aggregateEntities(rows.filter((r) => r.level === "ad"))) };
}

/** Piece-by-piece creative scores for the range. */
export async function GET(request: NextRequest) {
  const { scores } = await scoresFor(request);
  return Response.json({ scores });
}

/** Queue the next batch for the AI, briefed with this range's results. */
export async function POST(request: NextRequest) {
  const { preset, scores } = await scoresFor(request);
  const id = await addTask({
    task: `Next ad batch: 5 new ads from ${preset.replace(/_/g, " ")} results`,
    description: nextBatchBrief(scores, preset.replace(/_/g, " ")),
    department: "Marketing",
    role: "AI",
    assignee: AI_ASSIGNEE,
    status: "Up Next",
    priority: "High",
  });
  return Response.json({ ok: true, taskId: id });
}
