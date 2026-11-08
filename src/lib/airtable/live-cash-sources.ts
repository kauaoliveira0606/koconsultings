import type { LiveCashSource } from "./live-cash";
import { BRONSON_BASE_ID } from "./tables";

/** The three per-sale logs behind Bronson's Live Cash Today card (and the Discord ops bot). */
export const BRONSON_LIVE_CASH_SOURCES: Record<"postCallNotes" | "affiliatePcn" | "followUpPayments", LiveCashSource> = {
  postCallNotes: { baseId: BRONSON_BASE_ID, tableId: "tbltiRXQvojxiTJaM", cashFields: ["Cash Collected"] },
  affiliatePcn: { baseId: BRONSON_BASE_ID, tableId: "tblXsKo89QNuRawBy", cashFields: ["CPA (Payout / Cash Collected)"] },
  followUpPayments: {
    baseId: BRONSON_BASE_ID,
    tableId: "tblIv06rB4qG0msnZ",
    dateField: "Payment Collected Date",
    cashFields: ["Cash Collected"],
  },
};
