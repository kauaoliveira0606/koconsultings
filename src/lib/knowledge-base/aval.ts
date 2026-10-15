import { withAllSections, type KbItem } from "./types";

/*
 * Aval / Mind Over Market (Benicio Valentin, "AvalTrades"). Sources: the
 * offer stack the user supplied (2026-10-15), the mindovermarket.com pages
 * (/guide, /materials, /confirmation, /masterclass-replay) and the
 * @AvalTrading YouTube channel.
 */

const SITE = "https://www.mindovermarket.com";

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

const win = (title: string, meta: string, image: string): KbItem => ({
  title,
  meta,
  image: `${SITE}/images/${image}`,
});

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
          text: [
            "For the people who only want live trading.",
            "You can do split pays of 2 or 3, then just charge them $500 monthly. It's pretty much an MRR offer.",
          ],
          bullets: [
            "5 live trading classes a week",
            "Course",
          ],
          checkouts: [
            {
              title: "$1.5K paid in full, then $500 a month",
              text: "No financing: they pay $1.5K in full. The $500 a month is built into this link and starts charging after 90 days, once the full program length is over.",
              href: "https://whop.com/checkout/plan_sgbED3FSw7vb5",
            },
            {
              title: "$1.5K financed",
              text: "If they have to finance the $1.5K. This link doesn't include the $500 a month, so they also need a new recurring membership: send them the $500 a month link below.",
              href: "https://whop.com/checkout/plan_VVZv649Y7vQ3V",
            },
            {
              title: "$500 a month",
              text: "The $500 monthly recurring membership. Send it to anyone who financed the $1.5K.",
              href: "https://whop.com/checkout/plan_qD7kXE3CdUHYD",
            },
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

  content: [
    {
      title: "Featured Videos",
      description: "The videos on the Opportunity Guide page. Send these first.",
      layout: "rows",
      items: [
        yt("fgSUgtsWfmA", "Benicio's full story", "Lead who wants to know who Benicio is and if he's real. YouTube title: \"How I Went From Broke and Lost To A Millionaire at 19 (My Story)\".", "Story"),
        yt("titMR4fUOQE", "The full strategy breakdown", "Lead who asks what we actually trade. YouTube title: \"Revealing The Strategy That Made Me $25,000 in 20 Days (Just Copy Me)\".", "Jun 2026"),
        yt("xCgOd6hn6kQ", "The strategy I trade, step by step", "Same question, the newer video. YouTube title: \"This Asia Session Strategy Made Me $137,000 In 30 Days\". Also on the Materials page.", "Sep 2026"),
      ],
    },
    {
      title: "Pages To Send",
      description: "Send before a booked call so the lead shows up warm.",
      layout: "rows",
      items: [
        page("/confirmation", "Call Confirmed", "Right after a call is booked: the pre-call training, the steps to confirm, student interviews, student payouts and FAQ videos.", [
          "Is this just another course or signal group?",
          "Do I need experience to start?",
          "How much time do I need to put in each day?",
          "What makes this different from everything else out there?",
          "How soon can I get results?",
          "Is this legit? Can I trust this?",
          "What happens after I join?",
        ]),
        page("/materials", "Materials", "Lead with doubts about time, results or whether it's legit: FAQ videos, the strategy video, Benicio's payout proof and student interviews.", [
          "Is this just another course or signal group?",
          "Do I need experience to start?",
          "How much time do I need to put in each day?",
          "What makes this different from everything else out there?",
          "What is the worst-case scenario?",
          "Addressing reviews transparently",
          "How long will it take to see results?",
        ]),
        page("/guide", "The Opportunity Guide", "Lead who wants to read everything: Benicio's story, the framework, the 90 day roadmap, payout proof, student interviews and wins, and the written FAQ (capital needed, losing money, partner on the call)."),
        page("/masterclass-replay", "Masterclass Replay", "Lead who registered but missed the live masterclass. The replay video isn't up yet; the page is live with student wins and interviews."),
      ],
    },
    {
      title: "YouTube Videos",
      description: "Long-form videos from @AvalTrading, newest first.",
      layout: "rows",
      items: [
        yt("LxN5lRj-Els", "This one trading confluence made me $182,400 in 60 days", "Lead who wants to see the edge behind the results.", "Oct 2026"),
        yt("xCgOd6hn6kQ", "This Asia session strategy made me $137,000 in 30 days", "Our most watched recent video. Lead who asks what we trade.", "Sep 2026"),
        yt("3F_Oayf9rwk", "POV: taking $55,000 in prop firm payouts", "Lead who doubts prop firms actually pay out.", "Jun 2026"),
        yt("titMR4fUOQE", "Revealing the strategy that made me $25,000 in 20 days (just copy me)", "Lead who wants to learn the strategy before buying.", "Jun 2026"),
        yt("HoAxWZTd0yM", "The only 3 concepts I use to make $9,720/day trading", "Lead who thinks trading is too complicated.", "Apr 2026"),
        yt("1XEFHIXzlpk", "These 3 mindset changes made me $1,180,600 in trading... copy me", "Lead who knows it's their psychology.", "Apr 2026"),
        {
          title: "Full channel",
          text: ["Check here for anything newer than this list."],
          links: [{ href: "https://www.youtube.com/@AvalTrading", label: "Open" }],
          copy: "https://www.youtube.com/@AvalTrading",
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
          title: "Sugar: blowing accounts to $50K+ in payouts",
          meta: "Came in knowing basically nothing about trading",
          text: [
            "Sugar blew his first account in minutes. Six months into Mind Over Market he had pulled over $50K in payouts, and he now mentors other members.",
          ],
          quote: "I went from blowing accounts to hitting $50K in payouts in under 6 months. One shift in how I approached my trades changed everything.",
          links: [
            { href: "https://www.youtube.com/watch?v=DE1zyjf7eqw", label: "Full video" },
            { href: `${SITE}/materials`, label: "Materials page" },
          ],
        },
      ],
    },
    {
      title: "Student Interviews",
      description: "Unscripted student recordings.",
      layout: "rows",
      items: [
        {
          title: "Johnny: years of blown accounts to $100K months",
          text: ["Johnny failed over and over before Mind Over Market. Now $10K months are his baseline and he hit $100K in January."],
          links: [{ href: "https://www.youtube.com/watch?v=jyE_87ndx9E", label: "Watch" }],
          copy: "https://www.youtube.com/watch?v=jyE_87ndx9E",
          note: "The /confirmation page labels this same video as Landon. The guide, materials and replay pages say Johnny.",
        },
        {
          title: "Sugar: blowing accounts to $50K+ in payouts",
          text: ["Six months in, over $50K in payouts. Now mentors other members."],
          links: [{ href: "https://www.youtube.com/watch?v=DE1zyjf7eqw", label: "Watch" }],
          copy: "https://www.youtube.com/watch?v=DE1zyjf7eqw",
        },
        {
          title: "Landon: from stuck to consistent payouts",
          text: ["Landon spent years without a repeatable process. Now he trades one framework and takes consistent payouts. His interview is on the site pages, not on YouTube."],
          links: [{ href: `${SITE}/guide#interviews`, label: "Open" }],
          copy: `${SITE}/guide#interviews`,
        },
      ],
    },
    {
      title: "Big Numbers",
      layout: "gallery",
      items: [
        win("Isaac: $100K+ in payouts", "Total payouts", "testimonials/t16.webp"),
        win("Landon: $85K month", "Passed 5 more accounts", "testimonials/t15.webp"),
        win("Anthony: crossing $100K in profits", "This year", "testimonials/t14.webp"),
        win("Landon: $35K month", "Bought a new truck", "testimonials/t13.webp"),
        win("Landon: $10,000 in one payout", "$30,000 month", "testimonials/t12.webp"),
        win("Landon: $24,000 in a week", "Student", "testimonials/t4.webp"),
        win("Nahom: another $10K payout", "$30K month, Topstep + Apex", "testimonials/t5.webp"),
        win("Nahom: 10 payouts approved", "Halfway through the month", "testimonials/t17.webp"),
        win("Chris: first $10,000 month", "Student", "testimonials/t3.webp"),
        win("Hit $10K on PA accounts", "Student", "testimonials/t10.webp"),
      ],
    },
    {
      title: "Payout Proof",
      description: "Straight from the funding portals.",
      layout: "gallery",
      items: [
        win("Isaac: $50K", "Student payout proof", "proof/isaac-50k.webp"),
        win("Nahom: $30K", "Student payout proof", "proof/nahom-10k.webp"),
        win("Nahom: $25K", "Student payout proof", "proof/nahom-25k.webp"),
        win("Landon", "Student payout proof", "proof/landon.webp"),
        win("Jonah P", "Student payout proof", "proof/jonah.webp"),
        win("Keo", "Student payout proof", "proof/keo.webp"),
        win("Benicio's payouts", "Withdrawal requests in the funding portal", "payouts/p1.webp"),
        win("Benicio's payouts", "Full list of withdrawal requests", "payouts/p2.webp"),
        win("Benicio's payouts", "Withdrawals paid to bank account", "payouts/p3.webp"),
        win("Benicio's payouts", "Wire withdrawals from the funding portal", "payouts/p4.webp"),
      ],
    },
    {
      title: "Early Wins & First Payouts",
      description: "Best for a beginner who doubts they can get started.",
      layout: "gallery",
      items: [
        win("Jonah: quit his job", "After a $5,000 payout", "testimonials/t18.webp"),
        win("$6K payout secured", "Student", "testimonials/t11.webp"),
        win("Joe: +$3,600", "Passed his first eval", "testimonials/t21.webp"),
        win("Ollie: passed 4 50K Apex accounts", "Student", "testimonials/t22.webp"),
        win("Niels: first payout", "No losing trade in over a month", "testimonials/t20.webp"),
        win("Matthew: first ever payout", "After a year and two months", "testimonials/t1.webp"),
        win("Jacob: first ever payout", "Student", "testimonials/t19.webp"),
        win("Angelo: second Topstep payout", "Payout requested", "testimonials/t6.webp"),
        win("Passed first funded account in 3 weeks", "Student", "testimonials/t2.webp"),
        win("First funded account passed", "Made $500 the next day", "testimonials/t9.webp"),
        win("Elliot: funded 50K Apex account", "Certificate", "testimonials/t8.webp"),
        win("Frankie: passed his first eval", "Student", "testimonials/t7.webp"),
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
            "Never promise a lead they will make a specific amount, or by a specific date.",
            "Share the guarantee only in its exact current wording (see Products & Offers).",
            "Never call it financial advice and never give a lead a trade to take. We don't give signals.",
            "Don't call results typical or average. Every result shown is an individual one.",
            "Never tell a lead they can't lose money. Losing trades are part of trading; what they control is the size of the loss.",
          ],
        },
      ],
    },
  ],
});
