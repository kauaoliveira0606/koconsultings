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
    id: "ads",
    label: "Ads & creative",
    about: "Meta ads, creative, hooks, cost per registration, CPM, frequency, ROAS.",
    words: ["ad ", "ads", "creative", "hook", "hold", "ctr", "cpm", "frequency", "roas", "cost per registration", "media buyer", "mkt-ads", "mkt-dr", "copywriter", "copy framework", "ad format", "ad writing"],
    focus: "Ad spend efficiency, cost per registration vs the $15 goal, CPM, frequency, creative fatigue, testing cadence, and whether paid traffic is profitable.",
  },
  {
    id: "low-ticket",
    label: "Low ticket",
    about: "Front-end offers: the $27 VIP masterclass upgrade, the $147/mo AI offer, affiliate software.",
    words: ["low ticket", "affiliate", "vip", "order bump", "ai offer", "front-end", "front end", "software"],
    focus: "Low ticket take rates (VIP, AI offer), front-end cash per registration, and how well low ticket buyers ascend to high ticket.",
  },
  {
    id: "high-ticket",
    label: "High ticket",
    about: "The coaching program sale: pricing, payment plans, deposits, close rate, cash collected.",
    words: ["high ticket", "close rate", "closing", "pricing", "payment plan", "deposit", "sales call", "sls-", "objection", "pitch", "aov"],
    focus: "High ticket close rate, cash collected vs contract value, payment plans and deposits, objections (money, partner, think about it), and pricing.",
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
    words: ["offer", "value equation", "guarantee", "upsell", "ascension", "ecosystem", "cao-", "bonus", "narrative"],
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

/** Areas Jeremy AI gives feedback on (the business areas, not Clients / General). */
export const FEEDBACK_AREAS = AREAS.filter((a) => a.focus);

/** Areas a doc belongs to, from its title, category, summary and metric tags. */
const AGENT_AREAS: Record<string, string[]> = {
  "media buyer": ["ads"],
  copywriter: ["ads", "vsl", "email-sms"],
  "web designer": ["vsl", "confirmation"],
  research: ["offers"],
  cmo: ["ads"],
  cso: ["high-ticket", "sales-team"],
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
  if (doc.type === "Format" && !hits.includes("ads")) hits.unshift("ads");
  return hits.length ? hits : ["general"];
}
