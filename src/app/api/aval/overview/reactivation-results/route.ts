import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { getAvalAffiliatePcn, getAvalPostCallNotes } from "@/lib/airtable/tables-aval";
import { getReactivationLeads, getReactivationMessages } from "@/lib/airtable/reactivation";
import { buildReactivationOverview } from "@/lib/reactivation";

export const revalidate = 60;

/** The high-level Reactivation row on /aval/overview; the full view is /aval/reactivation. */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const [leads, messages, affiliatePcn, htPcn] = await Promise.all([
    getReactivationLeads(),
    getReactivationMessages(),
    getAvalAffiliatePcn(),
    getAvalPostCallNotes(),
  ]);
  return Response.json(buildReactivationOverview(leads, messages, affiliatePcn, htPcn, range));
}
