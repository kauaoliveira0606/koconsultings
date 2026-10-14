import { withAllSections, type KbItem } from "./types";

/*
 * Bronson / The Inner Table. Sources: the ad-ventur.com pages (/lt, /masterclass,
 * /masterclass-confirmation, /the-next-level, /testimonials, /materials,
 * /free-resource, /terms, /guide), the closer script, the Post Call Notes offer
 * list, and Bronson's YouTube channel (@Bronny.builds). Last filled 2026-10-14.
 */

const SITE = "https://www.ad-ventur.com";

const yt = (id: string, title: string, sendWhen: string, meta?: string): KbItem => ({
  title,
  meta,
  text: [sendWhen],
  links: [{ href: `https://www.youtube.com/watch?v=${id}`, label: "Watch on YouTube" }],
  copy: `https://www.youtube.com/watch?v=${id}`,
});

const win = (title: string, who: string, detail: string, image: string): KbItem => ({
  title,
  meta: who,
  quote: detail,
  image: image.startsWith("http") ? image : `${SITE}${image}`,
});

const GHL_IMG = (file: string) =>
  `https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/COotKpt86Tsar2SeLpWc/media/${file}`;

export const BRONSON_KNOWLEDGE_BASE = withAllSections({
  offers: [
    {
      title: "Positioning",
      description: "How we describe the business in every conversation.",
      items: [
        {
          title: "The Inner Table: subscription-based e-commerce",
          text: [
            "The company is The Inner Table. The model is subscription-based e-commerce: pick one proven product people use up and reorder (supplements and other consumables), put your own brand on it, and build monthly recurring revenue.",
            "We position against generic dropshipping and the endless product-testing loop. One product, chosen on data, built into a real brand that can be sold one day.",
          ],
          bullets: [
            "Say \"subscription-based e-commerce\", never \"AI dropshipping\".",
            "Bronson is an active operator: his own subscription brand does $600K+ a month.",
            "The ladder: white label brand, then private label (own inventory, Amazon FBA), then exit.",
          ],
        },
      ],
    },
    {
      title: "Front End",
      description: "What a lead can get before a sales call.",
      items: [
        {
          title: "Free Course + AI Tools (Base44)",
          meta: "Free · stated value $3,000 · on /lt and /paid",
          text: [
            "The opt-in offer. Bronson used to charge $3,000 for the course; an AI company (Base44) now covers it so students use their tool. The lead fills out a short form, a coach sets them up with the AI tool on a call, and they get instant access to the private portal.",
          ],
          bullets: [
            "Fully built AI online store ($1,000 value)",
            "Step-by-step course, follow-along format ($1,200 value)",
            "Personal onboarding call (free)",
            "AI tools ($500 value)",
            "Exclusive partner deals ($200 value)",
            "Business tools: calculators and planners ($100 value)",
            "Thousands in prizes and rewards every 60 days",
          ],
          links: [{ href: `${SITE}/lt`, label: "Open /lt" }],
        },
        {
          title: "Live Masterclass",
          meta: "Free · Sundays 3:00 PM EST · live only",
          text: ["\"Learn how to build a subscription based e-commerce brand that pays you consistently every month.\" Registration runs through WebinarJam."],
          bullets: [
            "01: How to find a winning product and build your store with no e-com experience",
            "02: How to get traffic and your first sales without wasting your budget or quitting your job",
            "03: How to turn every customer into monthly income (MRR) instead of starting from zero",
            "04: Live Q&A with Bronson",
            "Free VIP gift for attending live",
          ],
          links: [
            { href: `${SITE}/masterclass`, label: "Open /masterclass" },
            { href: `${SITE}/masterclass-replay`, label: "Replay page" },
          ],
        },
        {
          title: "Subscription Store Starter Kit",
          meta: "$27 one time · shown right after masterclass registration",
          bullets: [
            "Live access to the masterclass + live Q&A",
            "The Subscription-First E-commerce Mini Course",
            "The Subscription Store Templates (plug-and-play store templates)",
            "The Winner Debrief: full pre-recorded interview with a student who built a successful subscription-based e-commerce business",
            "\"Walk-In Ready\" guarantee: watch the mini course, plug in the templates, show up; if they don't like the masterclass, refund within 14 days",
          ],
          links: [{ href: `${SITE}/masterclass-confirmation`, label: "Open the offer page" }],
        },
      ],
    },
    {
      title: "High Ticket Mentorship",
      description: "Offer: Build a $1k/day MRR ecommerce business within 90 days. Sold on the call by the closers.",
      items: [
        {
          title: "$6.8K",
          meta: "6 month access",
          bullets: [
            "Bonus: 1:1 onboarding call (Getting inside program, giving personalized gameplan)",
            "Bonus: 14 day launch execution plan (Broken down into daily step-by-steps of exactly what to do, what to watch, and where to go)",
            "Bonus: Scaling roadmap (90 days)",
            "AI Bronson",
            "3 Coaching calls a week with Bronson (weekly breakdown of his own brand, Q&A, and brand breakdowns)",
            "Monthly brand audit looms (your store, ads, funnels, offer, etc)",
            "Community",
            "Quarterly event in person with Bronson for a weekend for an in-person mastermind to help you grow your brand 1-1 for top students",
            "Exit strategy (with a 10% profit split)",
          ],
        },
        {
          title: "$3.5K",
          meta: "Program length: 6 months",
          bullets: [
            "1:1 onboarding call (Getting inside program, giving personalized gameplan)",
            "14 day launch execution plan (Broken down into daily step-by-steps of exactly what to do, what to watch, and where to go)",
            "Scaling roadmap (90 days)",
            "AI Bronson",
            "3 Coaching calls a week with Bronson (weekly breakdown of his own brand, Q&A, and brand breakdowns)",
            "Community",
            "Exit strategy (with a 10% profit split)",
          ],
        },
        {
          title: "$1.5K",
          meta: "Program length: 3 months",
          bullets: [
            "1:1 onboarding call (Getting inside program, giving personalized gameplan)",
            "14 day launch execution plan (Broken down into daily step-by-steps of exactly what to do, what to watch, and where to go)",
            "Scaling roadmap (90 days) - to 1k a day",
            "3 Coaching calls a week with Bronson (weekly breakdown of his own brand, Q&A, and brand breakdowns)",
            "Community",
            "Exit strategy (with a 10% profit split)",
          ],
        },
        {
          title: "Also inside the program",
          bullets: [
            "Winning subscription product cheat sheet",
            "14 day launch playbook",
            "Plug-and-play store templates proven to convert",
            "DFY supplier connection",
            "DFY ad library swipefile and ad account set up",
            "90-day step-by-step daily actions scaling roadmap to 1K a day",
          ],
        },
        {
          title: "Payment options",
          meta: "From the closer script",
          bullets: [
            "Always push paid in full first.",
            "3-pay: $2,000 now, $2,000 next month, $2,000 the month after ($6,000 total, minimum $2,000 to start the top package).",
            "2-pay: $2,750 now and $2,750 next month.",
            "Financing through ClarityPay, grossed up to net $5,000.",
          ],
          note: "Never coach a lead on what income to put on a financing application. Don't push a buyer with no real capital into debt.",
        },
        {
          title: "Guarantee",
          copy: "Make your investment back within 180 days. If you don't, we work with you for free until you double your investment.",
          note: "Current wording since 2026-10-13. Some pages still show the older \"$1K revenue day within 90 days\" wording. Don't promise a money-back refund on the mentorship.",
        },
        {
          title: "The Next Level (current brand owners)",
          meta: "Same mentorship, pitched to people who already have a brand",
          bullets: [
            "Personalized audits: ads manager structure, website, ad creatives, marketing strategy",
            "Direct access to vetted suppliers",
            "Paid traffic training across Meta, TikTok and Google, with live ad audits",
            "3 Zoom calls a week + 24/7 access to the team",
          ],
          links: [{ href: `${SITE}/the-next-level`, label: "Open /the-next-level" }],
        },
      ],
    },
  ],

  content: [
    {
      title: "Pre-Call Pages",
      description: "Send before a booked call so the lead shows up warm.",
      items: [
        {
          title: "Before Your Call",
          text: ["What happens on the call, what to bring, a module preview, FAQ videos and student wins. Send right after a call is booked."],
          bullets: [
            "FAQ videos: Is dropshipping saturated? · What results can I realistically expect? · Can I do this with a full-time job? · I've never sold online, can I still do this? · Can I do this without knowing AI? · Subscription-based e-commerce explained · What's the catch? · How much does it cost to get started? · I'm not tech savvy, can I still do this?",
          ],
          links: [{ href: `${SITE}/free-resource`, label: "Open page" }],
          copy: `${SITE}/free-resource`,
        },
        {
          title: "Materials",
          text: ["FAQ videos plus student success. Good for a lead who has doubts about time, results or whether it's legit."],
          bullets: [
            "Can I still do this with a full-time job? · Past student results · Our transaction history · Bronson's personal results · How long does it take to see results? · Is this a long term business? · What makes Bronny different?",
          ],
          links: [{ href: `${SITE}/materials`, label: "Open page" }],
          copy: `${SITE}/materials`,
        },
        {
          title: "The Opportunity Guide",
          text: ["The full framework, the 14-day launch playbook, the 90-day scaling roadmap, revenue proof and every student story in one place. For the lead who wants to read everything."],
          links: [{ href: `${SITE}/guide`, label: "Open page" }],
          copy: `${SITE}/guide`,
        },
        {
          title: "Student Wins page",
          text: ["Every verified win, screenshots and video testimonials. Send to a skeptical lead."],
          links: [{ href: `${SITE}/testimonials`, label: "Open page" }],
          copy: `${SITE}/testimonials`,
        },
        {
          title: "For Parents",
          text: ["For a young lead whose parents are part of the decision."],
          links: [{ href: `${SITE}/parent`, label: "Open page" }],
          copy: `${SITE}/parent`,
        },
        {
          title: "About Bronson",
          links: [{ href: `${SITE}/about`, label: "Open page" }],
          copy: `${SITE}/about`,
        },
        {
          title: "Masterclass Replay",
          text: ["For a lead who registered but missed the live masterclass."],
          links: [{ href: `${SITE}/masterclass-replay`, label: "Open page" }],
          copy: `${SITE}/masterclass-replay`,
        },
      ],
    },
    {
      title: "YouTube (@Bronny.builds)",
      description: "Long-form videos, newest first. Older titles still say \"AI dropshipping\"; that's fine to send, just don't use the term yourself.",
      items: [
        yt("SafIc0fnn88", "How I make $550,000/mo from 1 AI business", "Proof Bronson is an active operator. Send to a lead who asks if he actually does this.", "Sep 2026"),
        yt("zSsbui2aVmg", "I tried the laziest way to make money with AI", "Light, easy watch for a cold or low-intent lead.", "Sep 2026"),
        yt("M7T15cw_tpM", "Copy & paste this strategy to make your first $1,000 online with AI", "Beginner who hasn't made a dollar online yet.", "Sep 2026"),
        yt("L92QvwY3QgU", "Disappear and come back unrecognizable (5 rules to change your life)", "Mindset. For a lead who says they're stuck or unmotivated.", "Sep 2026"),
        yt("R8AQN3nadgA", "I tried AI dropshipping for 1 year ($1,000/day+)", "One-year results. Good for a lead weighing if it's worth it long term.", "Sep 2026"),
        yt("_aB84Ck4yhI", "MRR is the best AI business to start in 2027 ($1,000/day+)", "Explains monthly recurring revenue. Send to anyone confused about the subscription model.", "Sep 2026"),
        yt("OXlK0zq2jjQ", "3 best AI businesses to start before 2027 ($1,000/day+)", "Our most watched video. Good first touch for a cold lead.", "Sep 2026"),
        yt("iMklsusK6wA", "Give me 15 minutes, I'll give you 10,000 hours of knowledge", "Dense value. For a lead who wants to learn before buying.", "Sep 2026"),
        yt("yrG71cbAaT0", "Laziest way to make money with AI ($1,000/day+)", "Easy watch for a cold or low-intent lead.", "Sep 2026"),
        yt("nWYmG65i3Rk", "How I make $600k/mo with Facebook ads (Facebook ads for beginners)", "Lead worried about running ads or wasting ad spend.", "Aug 2026"),
        yt("4Z5J3ytWvvY", "5 proven side hustles to make $1,000/day with AI (ranked)", "Lead comparing different side hustles.", "Aug 2026"),
        yt("Ed8OhMFwlnE", "How to start in 24 hours", "Lead who thinks it takes too long to get going.", "Aug 2026"),
        yt("LB32xwKhVOg", "How I made $550k this month testing AI image ads (product case study)", "Lead interested in ads and creatives.", "Aug 2026"),
        yt("haWIdz2mkko", "How I made $3.25M (store case study) (100% free course)", "Full store case study plus free course. Strong value follow-up.", "Jul 2026"),
        yt("IFLtc04KkQU", "How to actually build a brand worth millions (copy me)", "Lead who cares about building something they can sell one day.", "Jul 2026"),
        yt("1Oan8BkxQ4U", "How I made $450,000 this month with AI image ads (store case study)", "Ads proof and case study.", "Jun 2026"),
        yt("2zJlQs9kesQ", "How I've made $1.3M from Facebook ads in 2026 (free course + product reveal)", "Product reveal. For a lead stuck on what to sell.", "Jun 2026"),
        yt("vmLXJSjSf8s", "How I make $330k/mo with AI (store case study)", "Store case study.", "May 2026"),
        yt("D9PPbxnjti4", "How to actually pick a winning product every time (copy me)", "The 5-rule product framework. For a lead stuck testing products.", "May 2026"),
        yt("MiQ-4VLC-fo", "Helping a stranger make $20K/month", "Ryan's full case study. Our best proof video for a lead who doubts it works for normal people.", "Apr 2026"),
        yt("GArf9BXNlNk", "Facebook Ads tutorial 2026 (step by step guide)", "Lead who wants to understand Facebook ads.", "Feb 2026"),
        yt("eA7I6V26uPA", "I made $1,156,733 my first year doing branded e-com", "Bronson's own first-year story and the branded model explained.", "Dec 2025"),
        {
          title: "Full channel",
          text: ["Shorts go up almost daily; check the channel for anything newer than this list."],
          links: [{ href: "https://www.youtube.com/@Bronny.builds", label: "Open channel" }],
          copy: "https://www.youtube.com/@Bronny.builds",
        },
      ],
    },
  ],

  wins: [
    {
      title: "Case Study",
      items: [
        {
          title: "Ryan: from his dad's garage to $20K+ a month",
          meta: "26 · started Jul 7, 2025 · commercial real estate before",
          text: [
            "Living in his dad's garage with no AC and relying on his parents. Product ready end of September 2025, first Meta ads the first week of October, first profitable month December 2025. Hit $20K/month (later $24K to $25K) about 3 to 4 months into real traction.",
            "Now has his own one-bedroom in San Diego, a 3PL, and zero financial stress. Next goals: $100K/month, TikTok Shop, Amazon FBA, exit and build another brand.",
            "Why he picked Bronson: got burned by a $700 affiliate program that never answered him, passed on a $5K+ faceless company. Bronson was \"one guy\", transparent, a year and a half ahead of him.",
          ],
          quote: "If you don't like your job and you're not living the life you want, just do it.",
          links: [
            { href: "https://www.youtube.com/watch?v=MiQ-4VLC-fo", label: "Full video" },
            { href: `${SITE}/testimonials`, label: "Wins page" },
          ],
        },
      ],
    },
    {
      title: "Video Testimonials",
      description: "Unscripted student recordings, all on the Student Wins page.",
      items: [
        { title: "Zach", quote: "I'm already doing $500/day in sales." },
        { title: "Landon", quote: "I've learned a ton from this program and the fact that I'm building a business that I can sell one day is the best part." },
        { title: "Carlee", quote: "I went from the biggest hater to someone who will actually vouch for Bronson." },
        { title: "Johnathan", quote: "The community inside of this program is great! I love bouncing ideas off of other members and seeing how they succeed." },
        { title: "Ryan", quote: "Bronson really does give you all of the information and details that you need to succeed." },
        { title: "Dan", quote: "I've made over $16,000 since I've started, not that long ago." },
        { title: "Nate", quote: "I made my first thousands here." },
        { title: "Wes", quote: "The whitelabel method has worked the best for me." },
      ].map((t) => ({ ...t, links: [{ href: `${SITE}/testimonials`, label: "Watch on wins page" }] })),
    },
    {
      title: "Big Numbers",
      items: [
        { title: "Ryan: $20K/month", meta: "Personal record, scaled from zero in his first 90 days of traction" },
        win("Jaden: $8K day", "Six months into the program", "Best day.", "/13.webp"),
        win("Tyler: $100K in 2 weeks", "No prior e-com experience", "Scaling fast.", "/14.webp"),
        win("$30,000 in 23 days", "Student", "$30K revenue in the last 23 days.", GHL_IMG("67ee8b33585902432f7f8a20.jpeg")),
        win("$100K+ months incoming", "Supplement brand owner", "Getting into the big numbers.", GHL_IMG("67ee95b6e416f131f1a415da.png")),
        win("Kaleb", "Consistent growth", "The month over month growth has been nuts!", "/15.webp"),
      ],
    },
    {
      title: "Ads & ROAS",
      items: [
        win("8.79x ROAS", "Skin care niche, TikTok ads", "TikTok ads crushing it.", GHL_IMG("67ee920b8f6c2c4ed1a2d580.png")),
        win("3.59x ROAS", "New student, under 1 month in", "Already scaling.", GHL_IMG("67ee9318918308897e0d8c9b.png")),
        win("3.61x ROAS", "Organic hair & skin care brand", "Ripping sales with Meta ads.", GHL_IMG("67ee95224930c4210b003576.png")),
        win("$1,200 day at 11 ROAS", "New member", "11 ROAS on about $100 a day in ad spend.", "/wins/win-358.webp"),
        win("6.5 ROI in 3 weeks", "New member", "237 orders and $4,431 in revenue on $685 in ad spend.", "/wins/win-357.webp"),
        win("Micah", "1-on-1 ads help", "The 1-on-1 help with running the ads has been so awesome.", GHL_IMG("67ee8a07f504aeaca49f2f7f.jpeg")),
        win("Clothing brand: first drop sold out", "Clothing niche", "Strong ROAS on the first run.", GHL_IMG("67ee946b918308652f0d8de4.png")),
        win("Live results", "Current results", "No old screenshots here: the dates are at the bottom.", GHL_IMG("67ee939558590276507f9c6c.png")),
      ],
    },
    {
      title: "Early Wins & First Sales",
      description: "Best for a beginner who doubts they can get started.",
      items: [
        win("Layman: $5,137 in 90 days", "$2.5K in MRR", "105 orders after starting e-com on Feb 1st.", GHL_IMG("67ee96518f6c2cb9f8a2da5b.png")),
        win("Layman: $184 day", "Best day so far", "After bumping the ad budget to $72 a day.", "/wins/win-352.webp"),
        win("Daniel", "From zero", "1 month in and look at that spike. Zero sales before.", GHL_IMG("68e955a65db7d666d86e6e1e.png")),
        win("Shock: $1,020 in 30 days", "18 orders", "18 orders in the last 30 days.", "/wins/win-349.webp"),
        win("Ryan: $968 by midday", "Ryan", "I was exactly where all of you are now less than 7 months ago.", "/wins/win-362.webp"),
        win("Armen: $112 day", "Day 3 of ads", "This is how we finished day 3 of running ads!", "/wins/win-353.webp"),
        win("Armen: first sale", "First sale", "After a few weeks of hard work, I'm happy to now post about my first sale.", "/wins/win-354.webp"),
        win("Darian: first order in a week", "Supplement brand", "Got my first order on my supplement brand only a week in.", "/wins/win-361.webp"),
        win("Issac: first order", "Supplement brand", "Got my first order on my supplement brand.", "/wins/win-360.webp"),
        win("New student: more sales", "First sales", "Got another sale. $70 one this time.", "/wins/win-359.webp"),
        win("Logan: first sale", "First sale", "First sale came through!!! Can't wait to see how the future of this brand will grow.", "/wins/win-355.webp"),
        win("AkatsukiShinobi: first sale", "First sale", "First sale came thru! It can only be up from here.", "/wins/win-348.webp"),
        win("Alex: 2 weeks in", "First orders", "Finally got my first couple orders.", "/wins/win-351.webp"),
        win("Grif: first orders", "First orders", "God did!!!", "/wins/win-356.webp"),
        win("Trendyboym", "Community", "Seeing each of you posting your process has made it so much easier to keep pushing.", "/wins/win-350.webp"),
        win("Community win", "From the student community", "", "/wins/win-347.webp"),
      ],
    },
  ],

  disclaimers: [
    {
      title: "Rules",
      items: [
        {
          title: "When to add a disclaimer",
          bullets: [
            "Any time you share a student result, a revenue number or Bronson's own numbers, add the short income disclaimer.",
            "Never promise a lead they will make a specific amount, or by a specific date.",
            "Share a guarantee only in its exact current wording (see Products & Offers).",
            "Never coach a lead on what income to put on a financing application.",
            "Don't call results typical or average. Every result shown is an individual one.",
          ],
        },
      ],
    },
    {
      title: "Copy-Paste Wording",
      items: [
        {
          title: "Short income disclaimer",
          meta: "For DMs, texts and emails that mention results",
          copy: "Results mentioned are not typical. Individual results will vary based on effort, experience, background, and market conditions. This is an educational program. We make no guarantees of income or business outcomes.",
        },
        {
          title: "Income disclaimer (masterclass)",
          meta: "Masterclass pages and follow-up",
          copy: "INCOME DISCLAIMER: Results mentioned are not typical. Individual results will vary based on effort, experience, background, and market conditions. This masterclass is for educational purposes only. We make no guarantees of income or business outcomes.",
        },
        {
          title: "Meta compliance & earnings disclaimer",
          meta: "Pages and content used with Facebook / Instagram ads",
          copy: "This website is not endorsed by, affiliated with, or associated with Meta Platforms, Inc. (formerly Facebook, Inc.). Facebook is a trademark of Meta Platforms, Inc. The figures, revenue, and student results shown are not typical and are not a guarantee of earnings. Results vary based on individual effort, experience, background, and market conditions. Building an ecommerce business involves risk, including the loss of ad spend and inventory cost. Past results are not indicative of future results. This is for educational purposes only and does not constitute financial, legal, or tax advice.",
        },
        {
          title: "Earnings disclaimer (Terms of Service, section 5)",
          meta: "Full legal version",
          copy: "Our information products, courses, webinars, and services are educational in nature and do not guarantee any specific results, income, or financial outcomes. Your results depend on many factors including your prior knowledge and experience, the time and effort you invest, your implementation of strategies and tactics, market conditions and external factors, and your individual circumstances and capabilities. Any case studies, testimonials, or examples of results are not typical and do not represent average results. Past performance does not guarantee future results. Individual results vary widely.",
          links: [{ href: `${SITE}/terms`, label: "Terms of Service" }],
        },
      ],
    },
  ],
});
