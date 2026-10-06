import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { AVAL_BASE_ID, getAvalMarketingDailyMetrics } from "@/lib/airtable/tables-aval";
import { getDataCheck } from "@/lib/data-check";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  return Response.json(
    await getDataCheck(
      {
        baseId: AVAL_BASE_ID,
        getForm: getAvalMarketingDailyMetrics,
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
                tableId: "tblMsNIo5ZbNECcSv",
                cashFields: ["Cash collected High Ticket"],
                repFields: ["Your Name"],
              },
            ],
          },
          {
            label: "Affiliate PCN",
            metric: "lowTicket",
            tables: [{ tableId: "tblFZy89IvQ6Dcsl0", cashFields: ["CPA?"] }],
          },
          {
            label: "Affiliate EOD",
            metric: "lowTicket",
            tables: [
              {
                tableId: "tblMsNIo5ZbNECcSv",
                cashFields: ["Cash collected Affiliate"],
                repFields: ["Your Name"],
              },
            ],
          },
        ],
      },
      parseRangeFromRequest(request)
    )
  );
}
