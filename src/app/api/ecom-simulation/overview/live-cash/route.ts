import { getLiveCashToday } from "@/lib/airtable/live-cash";
import { ECOM_SIMULATION_BASE_ID } from "@/lib/airtable/tables-ecom-simulation";

// Polled every minute by the Live Cash Today card; the Airtable walk itself
// is still shared through the 60s table cache.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    await getLiveCashToday({
      postCallNotes: {
        baseId: ECOM_SIMULATION_BASE_ID,
        tableId: "tbltiRXQvojxiTJaM",
        cashFields: ["Cash Collected"],
        // Same call logged twice shares a Fathom link (see getPostCallNotes).
        dedupeField: "Fathom Link",
      },
      affiliatePcn: {
        baseId: ECOM_SIMULATION_BASE_ID,
        tableId: "tblXsKo89QNuRawBy",
        cashFields: ["Amount (CPA/Cash)"],
      },
    })
  );
}
