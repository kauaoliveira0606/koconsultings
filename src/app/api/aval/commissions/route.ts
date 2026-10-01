import { COMMISSIONS_OFFERS } from "@/lib/airtable/commissions";
import { commissionsGet } from "@/lib/commissions-routes";

// Clawbacks are written from the tab and must show immediately; the big
// Airtable tables are still cached for 60s inside airtableListAll.
export const dynamic = "force-dynamic";

export const GET = commissionsGet(COMMISSIONS_OFFERS.aval);
