import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { listReactivationRows } from "@/lib/airtable/reactivation";
import { buildNoShows } from "@/lib/no-shows";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const [leads, messages] = await Promise.all([
    listReactivationRows("bronsonMasterclass", "leads"),
    listReactivationRows("bronsonMasterclass", "messages"),
  ]);
  return Response.json(buildNoShows(leads, messages, range));
}
