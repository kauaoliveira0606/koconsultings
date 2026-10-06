import {
  MANUAL_STATUSES,
  getPaymentPlans,
  savePlanUpdate,
  type ManualStatus,
  type PaymentPlanOffer,
} from "@/lib/payment-plans";

/** Route handlers for an offer's Payment Plans tab, so each offer's route.ts stays a one-liner. */
export function paymentPlansGet(offer: PaymentPlanOffer) {
  return async () => Response.json(await getPaymentPlans(offer));
}

// A hand edit from the tab: a new balance, a status (Paid Off / Churned / Active), or both.
export function paymentPlansPatch(offer: PaymentPlanOffer) {
  return async (request: Request) => {
    const body = (await request.json().catch(() => null)) as {
      planId?: unknown;
      lead?: unknown;
      amountOwed?: unknown;
      status?: unknown;
    } | null;
    const planId = typeof body?.planId === "string" ? body.planId : "";
    const lead = typeof body?.lead === "string" ? body.lead.trim() : "";
    const amountOwed = body?.amountOwed;
    const status = MANUAL_STATUSES.find((s) => s === body?.status) as ManualStatus | undefined;
    const amountOk =
      amountOwed === undefined ||
      (typeof amountOwed === "number" && Number.isFinite(amountOwed) && amountOwed >= 0);
    if (
      !/^rec[A-Za-z0-9]{14}$/.test(planId) ||
      !amountOk ||
      (body?.status !== undefined && !status) ||
      (amountOwed === undefined && !status)
    ) {
      return Response.json(
        { error: "Expected { planId, lead?, amountOwed?: number >= 0, status?: Active | Paid Off | Churned }" },
        { status: 400 }
      );
    }
    await savePlanUpdate(offer, { planId, lead, amountOwed: amountOwed as number | undefined, status });
    return Response.json({ ok: true });
  };
}
