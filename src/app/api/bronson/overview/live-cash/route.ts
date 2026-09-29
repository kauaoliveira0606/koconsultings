import { getLiveCashToday } from "@/lib/airtable/live-cash";
import { BRONSON_BASE_ID } from "@/lib/airtable/tables";

// Polled every minute by the Live Cash Today card; the Airtable walk itself
// is still shared through the 60s table cache.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    await getLiveCashToday({
      postCallNotes: {
        baseId: BRONSON_BASE_ID,
        tableId: "tbltiRXQvojxiTJaM",
        cashFields: ["Cash Collected"],
      },
      affiliatePcn: {
        baseId: BRONSON_BASE_ID,
        tableId: "tblXsKo89QNuRawBy",
        cashFields: ["CPA (Payout / Cash Collected)"],
      },
      followUpPayments: {
        baseId: BRONSON_BASE_ID,
        tableId: "tblIv06rB4qG0msnZ",
        dateField: "Payment Collected Date",
        cashFields: ["Cash Collected"],
      },
    })
  );
}
