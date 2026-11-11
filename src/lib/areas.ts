/**
 * The business areas Berlin organizes knowledge and Jeremy AI's feedback by
 * (user, 2026-11-11: "separate this by section"). Each Skills and SOPs doc has
 * one or more areas; Jeremy AI gives feedback per area.
 */
export type Area = {
  id: string;
  label: string;
  /** What this area covers, for the page and Jeremy's brief. */
  about: string;
  /** Words that put a doc in this area (title, category, summary, metric tags). */
  words: string[];
  /** What Jeremy AI should judge in this area. */
  focus: string;
};

export const AREAS: Area[] = [
  {
    id: "copywriting",
    label: "Copywriting",
    about: "Everything written: ad copy, hooks, CTAs, masterclass and confirmation page copy, emails, scripts, brand voice and the copy rules.",
    words: ["copy", "copywriter", "hook", "cta", "headline", "brand voice", "ad writing", "narrative", "reasons", "body", "mkt-dr-001", "mkt-dr-002", "mkt-dr-004", "mkt-dr-005", "youtube"],
    focus: "Copy quality across ads, the masterclass and confirmation pages, emails and scripts: hooks, body, CTAs, offer language and the Bronson copy rules. What to rewrite first and why, using hook rate, hold rate, link CTR and opt-in rate as the signals.",
  },
  {
    id: "media-buying",
    label: "Media buying",
    about: "Meta ad buying: budgets, scaling, testing, cost per registration, CPM, frequency, ROAS.",
    words: ["media buyer", "mkt-ads", "paid advertising", "cpm", "frequency", "roas", "cost per registration", "budget", "ad spend", "campaign", "ad format", "creative testing", "ads"],
    focus: "Media buying: cost per registration against the $15 goal, CPM, frequency, budget allocation and scaling, testing cadence, and whether paid traffic pays back (ROAS). Not copy.",
  },
  {
    id: "market-research",
    label: "Market research",
    about: "Who the buyers are, what the market says, competitors, awareness level, targeting and lead quality.",
    words: ["research", "competitor", "cmp-", "market research", "market sophistication", "in-market", "icp", "ideal client", "avatar", "voice of customer", "intake", "lead quality", "positioning", "differentiation"],
    focus: "The market and the buyer: who is actually booking and buying vs who we want (lead quality), awareness level, objections, competitors' angles and the positioning gap. What research to run next.",
  },
  {
    id: "tickets",
    label: "High & low ticket",
    about: "The offers people pay for: the coaching program (high ticket) and the $27 VIP upgrade, $147/mo AI offer and affiliate software (low ticket).",
    words: ["high ticket", "low ticket", "close rate", "closing", "pricing", "payment plan", "deposit", "sales call", "sls-", "objection", "pitch", "aov", "affiliate", "vip", "order bump", "ai offer", "front-end", "front end", "software"],
    focus: "Both offer tiers. High ticket: close rate, cash collected vs contract value, payment plans and deposits, objections and pricing. Low ticket: VIP and AI offer take rates, front-end cash per registration, and how low ticket buyers ascend to high ticket.",
  },
  {
    id: "vsl",
    label: "VSL funnel",
    about: "Video sales letter pages, VSL watch time and the path from VSL to application.",
    words: ["vsl", "video sales letter", "vturb"],
    focus: "The VSL funnel: page conversion, VSL engagement, and VSL to application or booking.",
  },
  {
    id: "webinars",
    label: "Webinars",
    about: "The live masterclass: registration, show-up, retention to the pitch, booking from the room.",
    words: ["webinar", "masterclass", "retention", "live attendee", "fladlien", "booking rate", "registration"],
    focus: "Masterclass registration to attendance, retention until the pitch, and booking rate from the room.",
  },
  {
    id: "confirmation",
    label: "Confirmation pages & show-up",
    about: "Confirmation and thank-you pages, reminders and everything that gets people to show up.",
    words: ["confirmation", "show rate", "no-show", "no show", "show-up", "reminder", "thank you page", "pre-call", "prep"],
    focus: "Confirmation pages, reminders and pre-call content: show rate for the masterclass and for booked calls.",
  },
  {
    id: "offers",
    label: "Creating offers",
    about: "Offer design, value stack, guarantees, upsells and the offer ladder.",
    words: ["offer", "value equation", "guarantee", "upsell", "ascension", "ecosystem", "cao-cmo", "cao-upsell", "bonus"],
    focus: "The offer itself: value stack, guarantee, price points, the ladder from low ticket to high ticket, and fit with the people buying.",
  },
  {
    id: "sales-team",
    label: "Setters & closers",
    about: "Setter outreach, speed to lead, connection rate, closer process and the sales team.",
    words: ["setter", "closer", "sdr", "connection rate", "speed to lead", "eod", "sales team", "sales script", "dials", "pickup"],
    focus: "Setter speed to lead and connection rate, call quality, closer process, and team accountability (EODs, post call notes).",
  },
  {
    id: "email-sms",
    label: "Email & SMS",
    about: "Email and SMS follow-up, nurture, deliverability.",
    words: ["email", "sms", "deliverability", "subject line", "nurture", "mkt-eml"],
    focus: "Email and SMS follow-up: nurture, reminders, deliverability and how much it drives shows and sales.",
  },
  {
    id: "clients",
    label: "Clients",
    about: "Knowledge about each client and their buyers.",
    words: ["client:"],
    focus: "",
  },
  {
    id: "general",
    label: "General",
    about: "Working rules, operations and everything else.",
    words: [],
    focus: "",
  },
];

/** Old area ids (before the 2026-11-11 split) -> new ids, for saved sections and stored feedback. */
export const AREA_ALIASES: Record<string, string> = { ads: "media-buying", "low-ticket": "tickets", "high-ticket": "tickets" };
export const normalizeArea = (id: string) => AREA_ALIASES[id] ?? id;

/** Areas Jeremy AI gives feedback on (the business areas, not Clients / General). */
export const FEEDBACK_AREAS = AREAS.filter((a) => a.focus);

/** Areas a doc belongs to, from its title, category, summary and metric tags. */
const AGENT_AREAS: Record<string, string[]> = {
  "media buyer": ["media-buying"],
  copywriter: ["copywriting", "vsl", "email-sms"],
  "web designer": ["vsl", "confirmation"],
  research: ["market-research"],
  "content creator": ["copywriting"],
  cmo: ["media-buying", "copywriting"],
  cso: ["tickets", "sales-team"],
  coo: ["sales-team"],
};

export function areasFor(doc: { title: string; category: string; summary: string; covers: string[]; type: string }): string[] {
  if (doc.category.toLowerCase().startsWith("client:")) return ["clients"];
  // Agents are general roles whose descriptions mention everything: place them by name.
  if (doc.title.startsWith("Agent:")) {
    const key = Object.keys(AGENT_AREAS).find((k) => doc.title.toLowerCase().includes(k));
    return key ? AGENT_AREAS[key] : ["general"];
  }
  // Title, category and the metrics it fixes (summaries are too broad to sort by).
  const text = ` ${doc.title} ${doc.category} ${doc.covers.join(" ")} `.toLowerCase();
  const hits = AREAS.filter((a) => a.words.some((w) => text.includes(w))).map((a) => a.id);
  if (doc.type === "Format" && !hits.includes("media-buying")) hits.unshift("media-buying");
  if (doc.type === "Rules" && /copy|em dash|banned|wording|language/i.test(doc.title) && !hits.includes("copywriting")) hits.unshift("copywriting");
  return hits.length ? hits : ["general"];
}
