import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { getBronsonCommissions } from "@/lib/airtable/commissions";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  return Response.json(await getBronsonCommissions(range));
}
