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
        formTableId: "tblRdiOjEHQgth0TN",
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
            tableId: "tblFZy89IvQ6Dcsl0",
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
            tableId: "tblMsNIo5ZbNECcSv",
            identity: [["Your name", "Your Name"]],
          },
        ],
      },
      parseRangeFromRequest(request)
    )
  );
}
