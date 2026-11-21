import { withAllSections, type KbItem } from "./types";

/*
 * Aaron Thomas / SetterHQ (@aaronsets). Remote sales (setting + closing).
 * Front end: free kit + The Full Crash Course, unlocked by signing up for
 * the AI tool (Base44, monthly or yearly). Back end: Inner Circle.
 * Sources: the member portal (aaron-portal.vercel.app, Module 9 Student Wins
 * and Module 10 The Next Step), the @aaronsets YouTube channel, the
 * SetterHQ pages on aaron-free-kit.vercel.app and the Inner Circle stack
 * the user supplied (2026-11-20).
 */

const SITE = "https://aaron-free-kit.vercel.app";
const CHANNEL = "https://www.youtube.com/@aaronsets";

const yt = (id: string, title: string, sendWhen: string, meta: string): KbItem => ({
  title,
  meta,
  text: [sendWhen],
  links: [{ href: `https://www.youtube.com/watch?v=${id}`, label: "Watch" }],
  copy: `https://www.youtube.com/watch?v=${id}`,
});

const page = (path: string, title: string, sendWhen: string, bullets?: string[]): KbItem => ({
  title,
  text: [sendWhen],
  bullets,
  links: [{ href: `${SITE}${path}`, label: "Open" }],
  copy: `${SITE}${path}`,
});

const shot = (n: number, ext: "png" | "jpg"): KbItem => ({
  title: `Student result #${n}`,
  meta: "From the SetterHQ results wall",
  image: `${SITE}/home/testimonial-${n}.${ext}`,
});

export const AARON_KNOWLEDGE_BASE = withAllSections({
  offers: [
    {
      title: "Front End: Free Kit + The Full Crash Course",
      description: "What a new lead gets. Free, unlocked by signing up for the AI tool.",
      layout: "stack",
      items: [
        {
          title: "The free kit",
          meta: "Free. The only thing needed is to sign up for the AI tool (paid subscription, monthly or yearly)",
          bullets: [
            "The Full Crash Course: the whole system, start to finish",
            "The AI tool: builds their resume, finds offers and the people running them, writes their messages",
            "The outreach CRM: every offer, every reply, every follow-up in one place",
            "The job board: real roles Aaron checks himself",
            "Aaron's own tools: scripts, Loom template, bad-offer checklist, interview questions, follow-up tracker",
          ],
          text: [
            "Mechanism: the Sniper Placement System. Scope it (vet the offer), take the shot (one specific message, 3 a day), follow up.",
          ],
          note: "Never quote AI tool plan prices to a lead, and never promise a job on the front end. The yearly plan unlocks the Call Vault in the portal; monthly does not.",
        },
      ],
    },
    {
      title: "High Ticket: Inner Circle",
      description: "The back end, pitched on the call. Offer name is not final.",
      layout: "stack",
      items: [
        {
          title: "Inner Circle",
          badge: "Guarantee",
          meta: "Capped at 100 active people",
          text: [
            "Guarantee: get placed on an offer doing 6 figures a month, or we keep working with you for free until you do.",
            "Payment: 60% up front, the rest only after they collect $100K in cash. Tiers go by the amount of 1-on-1 help.",
          ],
          bullets: [
            "3 months of 1:1 coaching with Aaron (call reviews, Loom reviews, role plays)",
            "Group coaching calls twice a week for life (Wednesday and Friday, 12pm ET)",
            "The full curriculum for life",
            "90-day roadmap: day-by-day breakdowns with clear milestones",
            "Sales certification",
            "Placement support: every role vetted by Aaron, access to his network of offer owners",
            "24/7 access to Aaron",
            "Aaron AI: trained on his coaching calls, modules and 1-on-1 chats, instant feedback",
            "Accent coach",
            "Accountability pods of 3",
            "In-person mastermind",
            "Community",
          ],
          note: "No named packages yet. Post Call Notes log the deal by price point: $500-$1k, $3k, $5k, $10k-$15k+.",
        },
      ],
    },
  ],

  content: [
    {
      title: "Pages To Send",
      layout: "rows",
      items: [
        page("/home", "SetterHQ home", "Lead who wants to see who Aaron is and what SetterHQ does before booking."),
        page("/ty", "Call Confirmed", "Right after a call is booked, so the lead shows up warm."),
        page("/free-course", "Free kit + Full Crash Course", "Lead who isn't ready for a call yet. Gets them into the front end."),
      ],
    },
    {
      title: "FAQ Videos",
      description: "Short answers to the questions leads ask most.",
      layout: "rows",
      items: [
        yt("ehirE8VUFVw", "How does guaranteed placement work?", "Lead asking what the guarantee actually means.", "FAQ"),
        yt("uU_JaD7Z_cQ", "What makes SetterHQ different?", "Lead comparing us to other sales programs.", "FAQ"),
        yt("kr-a0-J28oY", "What if I don't have sales experience?", "Lead who thinks they need experience first.", "FAQ"),
        yt("52KvustIReM", "How much time do you need to commit to this?", "Lead with a job or school who worries about time.", "FAQ"),
        yt("SVAMKZm6JKQ", "How long will it take for me to see results?", "Lead asking how fast this works.", "FAQ"),
      ],
    },
    {
      title: "YouTube Videos",
      description: "Long-form videos from @aaronsets. Send as value-driven follow-up.",
      layout: "rows",
      items: [
        yt("unBN2Q6npUM", "How To Actually Land An Appointment Setting Role (No Experience)", "Lead stuck getting ignored when applying.", "Apr 2026"),
        yt("IuVmBwm6nDg", "How To Become an ELITE Appointment Setter in 2026 (From a $9M Setter)", "Lead who wants the full picture. His most watched video.", "Apr 2026"),
        yt("0s-TYZ9Jz2k", "Don't Start a Business, Do This Instead (My Story)", "Lead who wants to know who Aaron is.", "Jul 2026"),
        yt("O_ITxmMvUi8", "How I scaled this offer from $170k to $851k/mo in 4 months", "Lead who doubts Aaron's results.", "Jan 2026"),
        yt("_M3q_K5RtHE", "The ONLY 6 Appointment Setting Jobs That Will Make You Rich in 2026", "Lead unsure which offers are worth working on.", "Sep 2026"),
        yt("wuIWWOl2JZg", "I Tried Appointment Setting For 7 Days (real results)", "Lead who thinks it's too good to be true.", "Oct 2026"),
        yt("C2cL6ihpM4o", "Day In The Life Of A High Ticket Appointment Setter Making $1,200/Day", "Lead who wants to see what the job looks like.", "Aug 2026"),
        yt("wsX3F2mHOxU", "Claude + Appointment Setting = Easiest $10k/Mo of Your Life", "Lead curious how AI fits in.", "Sep 2026"),
        yt("41eIsW4k_0w", "Watch Me Audit 12 Setter Loom Applications LIVE", "Lead working on their Loom.", "Nov 2026"),
        yt("OFVxrIxcA6k", "How I Get Vague Prospects to ACTUALLY Open Up On My Sales Calls", "Lead already setting who wants better calls.", "Nov 2026"),
        {
          title: "Full channel",
          text: ["Check here for anything newer than this list."],
          links: [{ href: CHANNEL, label: "Open" }],
          copy: CHANNEL,
        },
      ],
    },
  ],

  wins: [
    {
      title: "Case Study",
      layout: "stack",
      items: [
        {
          title: "Offer owner: $170K to $851K a month",
          meta: "Aaron's own result as setter / setter manager",
          text: ["Aaron helped scale one offer from $170K a month to $851K a month in 4 months."],
          links: [
            { href: "https://www.youtube.com/watch?v=Kmoc7oLtRUg", label: "Offer owner interview" },
            { href: "https://www.youtube.com/watch?v=O_ITxmMvUi8", label: "Full breakdown" },
          ],
        },
      ],
    },
    {
      title: "Student Interviews",
      description: "Unscripted student case studies (also in portal Module 9).",
      layout: "rows",
      items: [
        yt("xYenm8170Lk", "Mikhi: $145K collected in 1 month", "Collected $145K for her offer in one month as a setter, about $8K for her.", "Case study"),
        yt("NQRwa8kHYaw", "Emi: 18 years old, $10,079 his first month", "$300K collected for the offer, $10K for him in his first month of setting.", "Case study"),
        yt("kJFMGWBmLbM", "Denys: 18 years old, $10,228 in a month", "Came from serving jobs. $10,228 in commissions in one month.", "Case study"),
        yt("9-TLVEV-nSo", "Zorad: $21K in 1 month", "$414K collected for the offer in one month, $21K in commissions for him.", "Case study"),
        yt("vHX8bIdLRTk", "Diego: $11.5K in 30 days", "$176K collected for the offer, $11.5K for him in 30 days.", "Case study"),
        yt("1cGDHt88pQw", "Moony: 20 years old, $9K/mo from his bedroom", "$167K collected for the offer, $9K a month for him.", "Case study"),
        yt("7j4wu78G-SM", "Tarik: $7K+/mo role in 1 week", "Landed a $7K+/mo OTE role in one week, then broke every setter record at his company.", "Case study"),
        yt("TQsLdmq-y-o", "Albert: construction to $5K/mo", "Landed a role in about a week and a half. $5K in commissions his first full month.", "Case study"),
        yt("VHQL0mcRCEU", "High schooler: $8K/mo sending DMs", "A high schooler making $8K a month as a DM setter.", "Case study"),
        yt("dL_Zk-kooDQ", "Moe: 17 years old, out-earning his teachers", "$5K as a DM setter while still in high school.", "Case study"),
        yt("_-Iydn3Z94M", "Andrew: 37% to 90% show rate", "Took his show rate from 37% to 90% in 2 weeks.", "Case study"),
        yt("wVCzDfSXONU", "William: setter to closer in 2 months", "Moved up from setter to closer within 2 months.", "Case study"),
        yt("CyyvAcpoQYI", "Jordan: from no Loom to Brez Scales", "Went from not knowing how to make a Loom to working for Brez Scales and Alex Eubanks.", "Case study"),
        yt("kIvA7YHOEo0", "Donte: placed in 2 weeks", "Got placed in a role within 2 weeks.", "Case study"),
      ],
    },
    {
      title: "Results Wall",
      description: "Student screenshots from the SetterHQ site.",
      layout: "gallery",
      items: [
        shot(1, "png"),
        shot(2, "png"),
        shot(3, "png"),
        shot(4, "png"),
        shot(5, "png"),
        shot(6, "png"),
        shot(7, "png"),
        shot(8, "png"),
        shot(9, "jpg"),
        shot(10, "jpg"),
        shot(11, "jpg"),
        shot(12, "png"),
        shot(13, "jpg"),
        shot(14, "jpg"),
      ],
    },
  ],

  disclaimers: [
    {
      title: "Rules",
      layout: "stack",
      items: [
        {
          title: "When to add a disclaimer",
          bullets: [
            "Never promise a lead a specific income, or a role by a specific date.",
            "The free kit and the AI tool never guarantee a job. Guaranteed placement is only part of Inner Circle, and only in its exact wording (see Products & Offers).",
            "Student results are not typical and not a promise of what anyone will earn. Say so whenever you share one.",
            "Never quote AI tool plan prices or our commission on it.",
            "Commission figures are what the student earned; cash figures are what the offer collected. Never mix them up.",
          ],
        },
      ],
    },
  ],
});
