import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { BRONSON_BASE_ID, getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { getDataCheck } from "@/lib/data-check";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  return Response.json(
    await getDataCheck(
      {
        baseId: BRONSON_BASE_ID,
        getForm: getMarketingDailyMetrics,
        sources: [
          {
            label: "Post Call Notes + Follow Up Payment",
            metric: "highTicket",
            tables: [
              { tableId: "tbltiRXQvojxiTJaM", cashFields: ["Cash Collected"] },
              {
                tableId: "tblIv06rB4qG0msnZ",
                dateField: "Payment Collected Date",
                cashFields: ["Cash Collected"],
              },
            ],
          },
          {
            label: "EOD Closer",
            metric: "highTicket",
            tables: [{ tableId: "tbl0xIvtCZIjemZRZ", cashFields: ["Total Cash Collected"] }],
          },
          {
            label: "Affiliate EOD",
            metric: "highTicket",
            tables: [
              {
                tableId: "tblezCVnizBHKPL4Q",
                cashFields: ["cash collected high ticket"],
                repFields: ["Your name"],
              },
            ],
          },
          {
            label: "Affiliate PCN",
            metric: "lowTicket",
            tables: [{ tableId: "tblXsKo89QNuRawBy", cashFields: ["CPA (Payout / Cash Collected)"] }],
          },
          {
            label: "Affiliate EOD",
            metric: "lowTicket",
            tables: [
              {
                tableId: "tblezCVnizBHKPL4Q",
                cashFields: ["Cash collected affiliate"],
                repFields: ["Your name"],
              },
            ],
          },
        ],
      },
      parseRangeFromRequest(request)
    )
  );
}
