import { withAllSections } from "./types";

/*
 * Aval / Mind Over Market. Source: the offer stack the user supplied
 * (2026-10-15). Content, wins and disclaimers aren't filled in yet.
 */

export const AVAL_KNOWLEDGE_BASE = withAllSections({
  offers: [
    {
      title: "High Ticket Packages",
      description: "Offer: Learn how to be consistently profitable in less than 180 days, or you don't pay.",
      layout: "pricing",
      items: [
        {
          title: "$5.5K",
          meta: "6 months + $500 a month after 6 months to keep access",
          badge: "Guarantee",
          text: ["Guarantee: get a payout in less than 180 days or you don't pay."],
          bullets: [
            "5 live trading classes a week",
            "2 psychology a week",
            "3 coaching a week",
            "2 1-1s",
            "Private support chat",
            "Community",
            "Course",
          ],
        },
        {
          title: "$3.5K",
          meta: "6 months + $500 a month after 6 months to keep access",
          bullets: [
            "5 live trading classes a week",
            "Private support chat",
            "Community",
            "Course",
          ],
        },
        {
          title: "$1.5K",
          meta: "3 months + $500 a month after 3 months to keep access",
          text: ["For the people who only want live trading."],
          bullets: [
            "5 live trading classes a week",
            "Course",
          ],
        },
      ],
    },
    {
      title: "$15K Upsell",
      layout: "stack",
      items: [
        {
          title: "$15K Upsell",
          bullets: [
            "Weekly 1 on 1s for 12 weeks, so 12 total (Aval does 3)",
            "Private in person mastermind (on top of the regular mastermind we will do in the future for regular high ticket)",
            "Lifetime MOM, which has 10 calls per week (including the live trading)",
            "Private support chat with Aval and coach",
            "Private GC with the rest of the group (3 other people right now)",
          ],
        },
      ],
    },
    {
      title: "Bonuses",
      layout: "stack",
      items: [
        {
          title: "Bonuses",
          bullets: [
            "Plug-and-play trading setup templates",
            "Daily feed of watchlists: pre-market watchlist delivered to your phone every morning before the bell",
            "Personal psychology coach",
            "Done-for-you prop firm connections",
            "Backtested setup library",
          ],
        },
      ],
    },
    {
      title: "Guarantee",
      items: [
        {
          title: "Guarantee",
          meta: "Only for the $5.5K package",
          copy: "Get a payout in less than 180 days or you don't pay.",
        },
      ],
    },
  ],
});
