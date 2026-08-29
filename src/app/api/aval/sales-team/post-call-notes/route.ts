import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getAvalPostCallNotes } from "@/lib/airtable/tables-aval";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const rows = await getAvalPostCallNotes();
  const inRange = rows
    .filter((r) => isDateInRange(r.date, range))
    .sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? 1 : -1));

  return Response.json({ notes: inRange });
}
