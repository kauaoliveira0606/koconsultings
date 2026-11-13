import type { NextRequest } from "next/server";
import { listReactivationRows } from "@/lib/airtable/reactivation";
import { buildShowRate } from "@/lib/show-rate";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const session = request.nextUrl.searchParams.get("session");
  const [leads, messages, aiCalls] = await Promise.all([
    listReactivationRows("avalMasterclass", "leads"),
    listReactivationRows("avalMasterclass", "messages"),
    listReactivationRows("avalMasterclass", "aiCalls"),
  ]);
  return Response.json(buildShowRate(leads, messages, aiCalls, session));
}
