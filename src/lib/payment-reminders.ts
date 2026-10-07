/**
 * Discord reminders for the Payment Plans tab, read once a day by each
 * offer's n8n workflow (which posts every entry of `messages` when `count`
 * is above 0):
 *
 *   - the day before a payment is due
 *   - 15 days past due with nothing collected
 *   - 30 days past due: red alert, the student is about to be removed
 *
 * `?mode=overdue` instead lists everyone past due right now, for a one-off
 * catch-up post.
 */
import { addDaysToDateString, easternDateString } from "@/lib/date-range";
import { getPaymentPlans, type PaymentPlan, type PaymentPlanOffer } from "@/lib/payment-plans";

/** Days past due that get a second ping, and the day the red alert goes out. */
const SECOND_PING_DAY = 15;
const RED_ALERT_DAY = 30;

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

/** Everything the sales team needs to chase one payment. `loud` = every line bold (red alert). */
function planBlock(plan: PaymentPlan, today: string, loud: boolean): string {
  const overdue = plan.nextDue ? daysBetween(plan.nextDue, today) : 0;
  const made = plan.payments.length;
  const lines = [
    `${plan.leadName ?? "Unknown lead"} · ${plan.leadEmail ?? "no email logged"}`,
    `Owes ${money(plan.remaining)} of ${money(plan.total)} · paid ${money(plan.paid)} so far in ${made} payment${made === 1 ? "" : "s"}`,
    `Due ${day(plan.nextDue)}${overdue > 0 ? ` · ${overdue} day${overdue === 1 ? "" : "s"} past due` : ""}${plan.nextDueLogged ? "" : " · date assumed, none logged"}`,
    [
      plan.kind === "deposit" ? "Deposit" : "Payment plan",
      plan.installments ? `${plan.installments} split pay${plan.installments === 1 ? "" : "s"}` : null,
      plan.structure ? `"${plan.structure.replace(/\s+/g, " ")}"` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    [
      `Closer ${plan.closer ?? "not logged"}`,
      `set by ${plan.setter ?? "not logged"}`,
      plan.offer,
      plan.collectedOn ? `paid via ${plan.collectedOn}` : null,
      `started ${day(plan.startDate)}`,
    ]
      .filter(Boolean)
      .join(" · "),
  ];
  if (loud) return lines.map((l) => `**${l}**`).join("\n");
  return [`**${lines[0]}**`, ...lines.slice(1)].join("\n");
}

function section(title: string, plans: PaymentPlan[], today: string, loud = false, footer?: string) {
  if (plans.length === 0) return [];
  return [[title, ...plans.map((p) => planBlock(p, today, loud)), ...(footer ? [footer] : [])]];
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
    const mode = new URL(request.url).searchParams.get("mode") === "overdue" ? "overdue" : "daily";
    const today = easternDateString();
    const { plans } = await getPaymentPlans(offer);
    const open = plans.filter((p) => (p.status === "onTrack" || p.status === "overdue") && p.nextDue);
    const pastDue = (p: PaymentPlan) => daysBetween(p.nextDue as string, today);
    const link = `Log each payment on the Follow Up Payment form, or update the plan here: ${dashboardUrl}`;
    const redTitle = `🚨🚨🚨 **RED ALERT: ${RED_ALERT_DAY}+ DAYS PAST DUE, NOTHING COLLECTED** 🚨🚨🚨`;
    const redFooter = "**IF THIS IS NOT COLLECTED NOW, THE STUDENT GETS REMOVED.**";

    let sections: string[][];
    let included: PaymentPlan[];
    if (mode === "overdue") {
      const overdue = open.filter((p) => pastDue(p) > 0).sort((a, b) => pastDue(b) - pastDue(a));
      const red = overdue.filter((p) => pastDue(p) >= RED_ALERT_DAY);
      const rest = overdue.filter((p) => pastDue(p) < RED_ALERT_DAY);
      included = overdue;
      sections = [
        ...section(redTitle, red, today, true, redFooter),
        ...section(`⚠️ **${rest.length} payment${rest.length === 1 ? "" : "s"} past due**`, rest, today),
      ];
    } else {
      const tomorrow = addDaysToDateString(today, 1);
      const dueTomorrow = open.filter((p) => p.nextDue === tomorrow);
      const second = open.filter((p) => pastDue(p) === SECOND_PING_DAY);
      const red = open.filter((p) => pastDue(p) === RED_ALERT_DAY);
      included = [...red, ...second, ...dueTomorrow];
      sections = [
        ...section(redTitle, red, today, true, redFooter),
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
    return Response.json({
      date: today,
      mode,
      count: included.length,
      messages: pack(sections),
      plans: included,
    });
  };
}
