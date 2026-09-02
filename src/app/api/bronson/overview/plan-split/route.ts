import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getBronsonAffiliatePcn } from "@/lib/airtable/tables";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const pcn = await getBronsonAffiliatePcn();
  const inRange = pcn.filter((r) => isDateInRange(r.date, range));

  let monthly = 0;
  let yearly = 0;
  let unknown = 0;
  for (const r of inRange) {
    const plan = (r.plan ?? "").trim().toLowerCase();
    if (plan === "monthly") monthly += 1;
    else if (plan === "yearly") yearly += 1;
    else unknown += 1;
  }
  const total = monthly + yearly + unknown;

  return Response.json({
    monthly,
    yearly,
    unknown,
    total,
    yearlyShare: total > 0 ? yearly / total : null,
  });
}
