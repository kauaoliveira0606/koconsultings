import { offerSplitGet } from "@/lib/offer-split";
import { PAYMENT_PLAN_OFFERS } from "@/lib/payment-plans";

export const revalidate = 60;

export const GET = offerSplitGet(PAYMENT_PLAN_OFFERS.bronson);
