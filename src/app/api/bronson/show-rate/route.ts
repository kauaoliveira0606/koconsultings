import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { listReactivationRows } from "@/lib/airtable/reactivation";
import { buildShowRate } from "@/lib/show-rate";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const [leads, messages, aiCalls] = await Promise.all([
    listReactivationRows("bronsonMasterclass", "leads"),
    listReactivationRows("bronsonMasterclass", "messages"),
    listReactivationRows("bronsonMasterclass", "aiCalls"),
  ]);
  return Response.json(buildShowRate(leads, messages, aiCalls, range));
}
