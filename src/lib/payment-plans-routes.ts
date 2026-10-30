import {
  MANUAL_STATUSES,
  getPaymentPlans,
  getPlansDue,
  savePlanUpdate,
  type ManualStatus,
  type PaymentPlanOffer,
} from "@/lib/payment-plans";

/** Route handlers for an offer's Payment Plans tab, so each offer's route.ts stays a one-liner. */
export function paymentPlansGet(offer: PaymentPlanOffer) {
  return async () => Response.json(await getPaymentPlans(offer));
}

/**
 * Who has a payment due `days` days from now (default 1 = tomorrow), with a
 * ready-to-post reminder. Read once a day by the offer's automation (n8n /
 * Zapier), which posts `message` to Discord when `count` is above 0.
 */
export function paymentPlansDueGet(offer: PaymentPlanOffer, dashboardUrl: string) {
  return async (request: Request) => {
    const raw = Number.parseInt(new URL(request.url).searchParams.get("days") ?? "1", 10);
    const days = Number.isFinite(raw) && raw >= 0 && raw <= 31 ? raw : 1;
    const { date, plans } = await getPlansDue(offer, days);
    const when = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(new Date(`${date}T12:00:00Z`));
    const lines = plans.map((p) => {
      const owed =
        p.remaining === null
          ? "balance not logged"
          : `$${Math.round(p.remaining).toLocaleString("en-US")} still owed`;
      return `• **${p.leadName ?? p.leadEmail ?? "Unknown lead"}**: ${owed} (${p.kind === "deposit" ? "deposit" : "payment plan"}, closer ${p.closer ?? "not logged"})`;
    });
    const label = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    const message = [
      `**${plans.length} payment${plans.length === 1 ? "" : "s"} due ${label} (${when})**`,
      ...lines,
      `Log it on the Follow Up Payment form once it lands: ${dashboardUrl}`,
    ].join("\n");
    return Response.json({ date, count: plans.length, message, plans });
  };
}

const isRealDate = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

// A hand edit from the tab: a new balance, a status (Paid Off / Churned / Active), an extension, or a mix.
export function paymentPlansPatch(offer: PaymentPlanOffer) {
  return async (request: Request) => {
    const body = (await request.json().catch(() => null)) as {
      planId?: unknown;
      lead?: unknown;
      amountOwed?: unknown;
      status?: unknown;
      extendedTo?: unknown;
    } | null;
    const planId = typeof body?.planId === "string" ? body.planId : "";
    const lead = typeof body?.lead === "string" ? body.lead.trim() : "";
    const amountOwed = body?.amountOwed;
    const status = MANUAL_STATUSES.find((s) => s === body?.status) as ManualStatus | undefined;
    const extendedTo = body?.extendedTo;
    const extensionOk =
      extendedTo === undefined || extendedTo === null || (typeof extendedTo === "string" && isRealDate(extendedTo));
    const amountOk =
      amountOwed === undefined ||
      (typeof amountOwed === "number" && Number.isFinite(amountOwed) && amountOwed >= 0);
    if (
      !/^rec[A-Za-z0-9]{14}$/.test(planId) ||
      !amountOk ||
      !extensionOk ||
      (body?.status !== undefined && !status) ||
      (amountOwed === undefined && !status && extendedTo === undefined)
    ) {
      return Response.json(
        { error: "Expected { planId, lead?, amountOwed?: number >= 0, status?: Active | Paid Off | Churned, extendedTo?: YYYY-MM-DD | null }" },
        { status: 400 }
      );
    }
    await savePlanUpdate(offer, {
      planId,
      lead,
      amountOwed: amountOwed as number | undefined,
      status,
      extendedTo: extendedTo as string | null | undefined,
    });
    return Response.json({ ok: true });
  };
}
