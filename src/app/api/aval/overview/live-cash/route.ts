import { getLiveCashToday } from "@/lib/airtable/live-cash";
import { AVAL_BASE_ID } from "@/lib/airtable/tables-aval";

// Polled every minute by the Live Cash Today card; the Airtable walk itself
// is still shared through the 60s table cache.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    await getLiveCashToday({
      postCallNotes: {
        baseId: AVAL_BASE_ID,
        tableId: "tbltiRXQvojxiTJaM",
        cashFields: ["Cash Collected"],
      },
      affiliatePcn: {
        baseId: AVAL_BASE_ID,
        tableId: "tblFZy89IvQ6Dcsl0",
        cashFields: ["CPA?"],
      },
      followUpPayments: {
        baseId: AVAL_BASE_ID,
        tableId: "tblIv06rB4qG0msnZ",
        dateField: "Payment Collected Date",
        cashFields: ["Cash Collected"],
      },
    })
  );
}
