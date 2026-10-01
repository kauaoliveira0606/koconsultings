import { COMMISSIONS_OFFERS } from "@/lib/airtable/commissions";
import { clawbackDelete, clawbackPost } from "@/lib/commissions-routes";

export const dynamic = "force-dynamic";

export const POST = clawbackPost(COMMISSIONS_OFFERS.aval);
export const DELETE = clawbackDelete(COMMISSIONS_OFFERS.aval);
