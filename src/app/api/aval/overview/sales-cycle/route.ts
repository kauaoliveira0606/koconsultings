import { SALES_CYCLE_OFFERS, salesCycleGet } from "@/lib/sales-cycle";

export const revalidate = 60;

export const GET = salesCycleGet(SALES_CYCLE_OFFERS.aval);
