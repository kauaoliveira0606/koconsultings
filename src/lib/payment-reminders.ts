/**
 * Discord reminders for the Payment Plans tab, read once a day by each
 * offer's n8n workflow (which posts every entry of `messages` when `count`
 * is above 0):
 *
 *   - the day before a payment is due
 *   - 15 days past due with nothing collected
 *   - 30 days past due: red alert headline, the student is about to be removed
 *   - (offers with access rules) a week before a customer's program access
 *     ends, and again the day it ends: time to renew or upsell them
 *
 * `?mode=overdue` instead lists everyone past due right now, for a one-off
 * catch-up post.
 *
 * The weekly summary (its own endpoint and workflow, Monday morning) covers
 * the seven days up to yesterday: what is still owed, what came in, who is
 * overdue.
 */
import { addDaysToDateString, easternDateString } from "@/lib/date-range";
import { getPaymentPlans, type PaymentPlan, type PaymentPlanOffer } from "@/lib/payment-plans";
import { getUpsellPotential, type RenewalCustomer } from "@/lib/upsell-potential";

/** Days past due that get a second ping, and the day the red alert goes out. */
const SECOND_PING_DAY = 15;
const RED_ALERT_DAY = 30;

/** Days before program access ends that the heads-up goes out. */
const RENEWAL_HEADS_UP_DAYS = 7;

/** Discord rejects anything over 2000 characters. */
const MESSAGE_LIMIT = 1900;

const money = (value: number | null) =>
  value === null ? "not logged" : `$${Math.round(value).toLocaleString("en-US")}`;

function day(ymd: string | null): string {
  if (!ymd) return "not logged";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${ymd}T12:00:00Z`));
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * Everything the sales team needs to chase one payment: the name on its own
 * line, then one labelled line per fact inside a Discord quote block. Only
 * the name, the amount owed and the days late are bold, so they are what the
 * eye lands on.
 */
function planBlock(plan: PaymentPlan, today: string): string {
  const overdue = plan.nextDue ? daysBetween(plan.nextDue, today) : 0;
  const late = overdue > 0 ? ` · **${overdue} day${overdue === 1 ? "" : "s"} late**` : "";
  const assumed = plan.nextDueLogged ? "" : " (assumed date, none logged)";
  const split = plan.installments
    ? `, ${plan.installments} split pay${plan.installments === 1 ? "" : "s"}`
    : "";
  const structure = plan.structure ? `, "${plan.structure.replace(/\s+/g, " ")}"` : "";
  const lines = [
    `Email: ${plan.leadEmail ?? "none logged"}`,
    `Owes: **${money(plan.remaining)}** of ${money(plan.total)} (paid ${money(plan.paid)} so far)`,
    `Due: ${day(plan.nextDue)}${late}${assumed}`,
    `Plan: ${plan.kind === "deposit" ? "Deposit" : "Payment plan"}${split}${structure}`,
    `Closer: ${plan.closer ?? "not logged"} · Setter: ${plan.setter ?? "not logged"}`,
    `Offer: ${[plan.offer, plan.collectedOn ? `paid via ${plan.collectedOn}` : null, `started ${day(plan.startDate)}`].filter(Boolean).join(", ")}`,
  ];
  return [`**${plan.leadName ?? "Unknown lead"}**`, ...lines.map((l) => `> ${l}`)].join("\n");
}

/** One customer whose program access is up: who they are, what they bought and when it ran. */
function renewalBlock(r: RenewalCustomer): string {
  const lines = [
    `Email: ${r.email ?? "none logged"}`,
    `Package: ${r.packageName} (${r.months} months of access)`,
    `Bought: ${day(r.purchased)} · Access ends: **${day(r.accessEnds)}**`,
    `Closer: ${r.closer ?? "not logged"} · Paid so far: ${money(r.cashCollected)}`,
    `Upsell status: ${r.status}${r.statusNote ? ` ("${r.statusNote.replace(/\s+/g, " ")}")` : ""}`,
  ];
  return [`**${r.name ?? "Unknown customer"}**`, ...lines.map((l) => `> ${l}`)].join("\n");
}

function section(title: string, plans: PaymentPlan[], today: string) {
  if (plans.length === 0) return [];
  return [[title, ...plans.map((p) => planBlock(p, today))]];
}

/** Packs blocks into as few Discord messages as fit, never splitting one customer in two. */
function pack(sections: string[][]): string[] {
  const messages: string[] = [];
  let current = "";
  for (const blocks of sections) {
    for (const block of blocks) {
      if (current && current.length + block.length + 2 > MESSAGE_LIMIT) {
        messages.push(current);
        current = "";
      }
      current = current ? `${current}\n\n${block}` : block;
    }
  }
  if (current) messages.push(current);
  return messages;
}

export function paymentRemindersGet(offer: PaymentPlanOffer, dashboardUrl: string) {
  return async (request: Request) => {
    const params = new URL(request.url).searchParams;
    const mode = params.get("mode") === "overdue" ? "overdue" : "daily";
    // `?date=YYYY-MM-DD` previews what would be posted on another day (nothing is sent from here).
    const preview = params.get("date") ?? "";
    const today = /^\d{4}-\d{2}-\d{2}$/.test(preview) ? preview : easternDateString();
    const { plans } = await getPaymentPlans(offer);
    const open = plans.filter((p) => (p.status === "onTrack" || p.status === "overdue") && p.nextDue);
    const pastDue = (p: PaymentPlan) => daysBetween(p.nextDue as string, today);
    const link = `Once it's paid, log it on the Follow Up Payment form or update the plan here:\n${dashboardUrl}`;
    // The red alert is loud in its headline only; the customer details stay as readable as any other.
    const redTitle = `🚨 **RED ALERT: ${RED_ALERT_DAY}+ DAYS PAST DUE** 🚨\nNothing collected. If this is not paid now, the student gets removed.`;

    let sections: string[][];
    let included: PaymentPlan[];
    if (mode === "overdue") {
      const overdue = open.filter((p) => pastDue(p) > 0).sort((a, b) => pastDue(b) - pastDue(a));
      const red = overdue.filter((p) => pastDue(p) >= RED_ALERT_DAY);
      const rest = overdue.filter((p) => pastDue(p) < RED_ALERT_DAY);
      included = overdue;
      sections = [
        ...section(redTitle, red, today),
        ...section(`⚠️ **${rest.length} payment${rest.length === 1 ? "" : "s"} past due**`, rest, today),
      ];
    } else {
      const tomorrow = addDaysToDateString(today, 1);
      const dueTomorrow = open.filter((p) => p.nextDue === tomorrow);
      const second = open.filter((p) => pastDue(p) === SECOND_PING_DAY);
      const red = open.filter((p) => pastDue(p) === RED_ALERT_DAY);
      included = [...red, ...second, ...dueTomorrow];
      sections = [
        ...section(redTitle, red, today),
        ...section(
          `⚠️ **${SECOND_PING_DAY} days past due, still not collected**`,
          second,
          today
        ),
        ...section(
          `🔔 **${dueTomorrow.length} payment${dueTomorrow.length === 1 ? "" : "s"} due tomorrow (${day(tomorrow)})**`,
          dueTomorrow,
          today
        ),
      ];
    }
    if (sections.length > 0) sections.push([link]);

    // Program access running out: a heads-up a week ahead, then the day it ends
    // (daily run only, offers with access rules).
    let renewalsToday: RenewalCustomer[] = [];
    if (mode === "daily" && offer.access) {
      const { renewals } = await getUpsellPotential(offer);
      const all = renewals?.customers ?? [];
      const ending = all.filter((r) => r.accessEnds === today);
      const inAWeek = addDaysToDateString(today, RENEWAL_HEADS_UP_DAYS);
      const soon = all.filter((r) => r.accessEnds === inAWeek);
      renewalsToday = [...ending, ...soon];
      const whose = (n: number) => `${n} customer${n === 1 ? "'s" : "s'"} program access`;
      if (ending.length > 0) {
        sections.push([
          `⏳ **${whose(ending.length)} ends today**\nTime to renew, resell or upsell them.`,
          ...ending.map(renewalBlock),
        ]);
      }
      if (soon.length > 0) {
        sections.push([
          `👀 **${whose(soon.length)} ends in ${RENEWAL_HEADS_UP_DAYS} days (${day(inAWeek)})**\nReach out now and pitch the renewal or upsell before they lose access.`,
          ...soon.map(renewalBlock),
        ]);
      }
      if (renewalsToday.length > 0) {
        sections.push([
          `Track renewals here:\n${dashboardUrl.replace(/payment-plans$/, "upsell-potential")}`,
        ]);
      }
    }
    // `?test=1` labels the post so nobody acts on a preview.
    if (params.get("test") === "1" && sections.length > 0) {
      sections.unshift(["🧪 **TEST RUN: this is only a preview of the reminder, no action needed.**"]);
    }
    return Response.json({
      date: today,
      mode,
      count: included.length + renewalsToday.length,
      messages: pack(sections),
      plans: included,
    });
  };
}

/** Weekly summary for the reminders channel: still owed, collected over the last 7 days, who is overdue. */
export function paymentWeeklySummaryGet(offer: PaymentPlanOffer, dashboardUrl: string) {
  return async () => {
    const today = easternDateString();
    const end = addDaysToDateString(today, -1);
    const start = addDaysToDateString(today, -7);
    const inWeek = (date: string | null) => date !== null && date >= start && date <= end;
    const { plans, summary } = await getPaymentPlans(offer);

    const collected = plans.flatMap((p) =>
      p.collections.filter((c) => inWeek(c.date) && c.amount > 0).map((c) => ({ plan: p, ...c }))
    );
    const collectedTotal = collected.reduce((t, c) => t + c.amount, 0);
    const started = plans.filter((p) => inWeek(p.startDate));
    const overdue = plans
      .filter((p) => p.status === "overdue" && p.nextDue)
      .sort((a, b) => (a.nextDue as string).localeCompare(b.nextDue as string));

    const head = [
      `📊 **Weekly payment plan summary · ${day(start)} to ${day(end)}**`,
      `> Still owed: **${money(summary.outstanding)}** across ${summary.active} active plan${summary.active === 1 ? "" : "s"}`,
      `> Collected this week: **${money(collectedTotal)}** in ${collected.length} payment${collected.length === 1 ? "" : "s"}`,
      `> New plans this week: ${started.length}`,
      `> Overdue: **${summary.overdue} plan${summary.overdue === 1 ? "" : "s"}, ${money(summary.overdueAmount)}**`,
    ].join("\n");

    const KIND = {
      first: "first payment on the call",
      followUp: "follow up payment",
      balanceUpdate: "balance updated on the dashboard",
      markedPaid: "marked paid in full",
    } as const;
    const collectedBlock =
      collected.length > 0
        ? [
            [
              "**Collected this week**",
              ...collected
                .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
                .map(
                  (c) =>
                    `> ${c.plan.leadName ?? "Unknown lead"} · **${money(c.amount)}** · ${day(c.date)} · ${KIND[c.kind]}`
                ),
            ].join("\n"),
          ]
        : [];
    const overdueLines = overdue.map((p) => {
      const late = daysBetween(p.nextDue as string, today);
      return `> ${p.leadName ?? "Unknown lead"} · **${money(p.remaining)}** · ${late} day${late === 1 ? "" : "s"} late · Closer ${p.closer ?? "not logged"} · ${p.leadEmail ?? "no email"}`;
    });
    // Ten customers per block, so a long overdue list spills into a second message cleanly.
    const overdueBlocks: string[] = [];
    for (let i = 0; i < overdueLines.length; i += 10) {
      const title = i === 0 ? "**Overdue right now**" : "**Overdue right now (continued)**";
      overdueBlocks.push([title, ...overdueLines.slice(i, i + 10)].join("\n"));
    }
    if (overdueBlocks.length === 0) overdueBlocks.push("**Nobody is overdue.**");
    const messages = pack([[head], collectedBlock, overdueBlocks, [`Full list: ${dashboardUrl}`]]);
    return Response.json({
      start,
      end,
      // Always 1: the summary posts every week, even a quiet one.
      count: 1,
      messages,
      collected: collectedTotal,
      outstanding: summary.outstanding,
      overdue: overdue.length,
    });
  };
}
