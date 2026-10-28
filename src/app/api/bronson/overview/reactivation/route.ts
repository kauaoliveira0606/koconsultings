import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { getBronsonAffiliatePcn } from "@/lib/airtable/tables";
import {
  getReactivationAiCalls,
  getReactivationLeads,
  getReactivationMessages,
} from "@/lib/airtable/reactivation";
import { buildReactivation } from "@/lib/reactivation";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const [leads, messages, aiCalls, pcn] = await Promise.all([
    getReactivationLeads("bronson"),
    getReactivationMessages("bronson"),
    getReactivationAiCalls("bronson"),
    getBronsonAffiliatePcn(),
  ]);
  return Response.json(buildReactivation(leads, messages, aiCalls, pcn, range));
}
