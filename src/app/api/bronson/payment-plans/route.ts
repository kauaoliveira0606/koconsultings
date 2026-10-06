import { PAYMENT_PLAN_OFFERS } from "@/lib/payment-plans";
import { paymentPlansGet, paymentPlansPatch } from "@/lib/payment-plans-routes";

// Edits made on the tab must show up right away.
export const dynamic = "force-dynamic";

export const GET = paymentPlansGet(PAYMENT_PLAN_OFFERS.bronson);
export const PATCH = paymentPlansPatch(PAYMENT_PLAN_OFFERS.bronson);
