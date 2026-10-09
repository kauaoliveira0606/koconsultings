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
        formTableId: "tblOMLyTcuhDwUZbF",
        duplicateChecks: [
          {
            label: "Post Call Notes",
            tableId: "tbltiRXQvojxiTJaM",
            identity: [["Email (Lead)", "Full Name (Lead)"], ["Call Outcome"]],
            cashFields: ["Cash Collected"],
            displayFields: ["Full Name (Lead)"],
          },
          {
            label: "Follow Up Payment",
            tableId: "tblIv06rB4qG0msnZ",
            dateField: "Payment Collected Date",
            identity: [["Lead Email", "Lead First Name"]],
            cashFields: ["Cash Collected"],
            displayFields: ["Lead First Name"],
          },
          {
            label: "Affiliate PCN",
            tableId: "tblXsKo89QNuRawBy",
            identity: [
              ["lead email", "Lead Email", "Lead name", "Lead Name"],
              ["Which software", "Which Software"],
            ],
            cashFields: ["CPA (Payout / Cash Collected)", "CPA?"],
            displayFields: ["Lead name", "Lead Name"],
          },
          {
            label: "EOD Closer",
            tableId: "tbl0xIvtCZIjemZRZ",
            identity: [["Closer Name"], ["Type Of Form Submission", "Type Of Form"]],
          },
          {
            label: "Affiliate EOD",
            tableId: "tblezCVnizBHKPL4Q",
            identity: [["Your name", "Your Name"]],
          },
        ],
      },
      parseRangeFromRequest(request)
    )
  );
}
