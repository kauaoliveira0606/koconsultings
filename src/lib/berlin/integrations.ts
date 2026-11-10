/**
 * The source stack a client funnel runs on, ported from Manos.
 * Two tiers: "dashboard" sources fill the numbers/pace/scorecard,
 * "claude" sources are optional and let the agent act on the account.
 */
export type Integration = {
  name: string;
  /** 1-2 letter avatar shown in the tile. */
  short: string;
  category: string;
  description: string;
  tier: "dashboard" | "claude";
  /** Can push data into the dashboard. */
  connectsToDashboard: boolean;
  /** Can be added to the Claude connector so the agent works on the account. */
  addToClaude: boolean;
};

export const INTEGRATION_CATEGORIES = [
  "Ads",
  "Data and attribution",
  "CRM",
  "Payments",
  "Automations",
  "SMS",
  "Research and audit",
  "Docs and files",
  "Design",
] as const;

export const INTEGRATIONS: Integration[] = [
  // Tier 1 — feeds the dashboard. Connect these first.
  { name: "Meta", short: "f", category: "Ads", tier: "dashboard", connectsToDashboard: true, addToClaude: true, description: "Meta Ads, spend and cost per lead, plus the Pixel and Conversions API." },
  { name: "Google Ads", short: "G", category: "Ads", tier: "dashboard", connectsToDashboard: true, addToClaude: false, description: "Search, YouTube and Performance Max: spend, impressions and clicks." },
  { name: "TikTok Ads", short: "Tk", category: "Ads", tier: "dashboard", connectsToDashboard: true, addToClaude: false, description: "TikTok ad accounts: spend, impressions and clicks." },
  { name: "Trakyo", short: "T", category: "Data and attribution", tier: "dashboard", connectsToDashboard: true, addToClaude: true, description: "From click to cash: which content and ad brought each lead, call and sale." },
  { name: "GoHighLevel", short: "HL", category: "CRM", tier: "dashboard", connectsToDashboard: true, addToClaude: true, description: "Contacts, pipelines, calls booked, shows and closes." },
  { name: "Close", short: "Cl", category: "CRM", tier: "dashboard", connectsToDashboard: true, addToClaude: true, description: "Leads, calls, opportunities and won deals, for teams that run on Close instead of GoHighLevel." },
  { name: "Commas", short: "C", category: "Payments", tier: "dashboard", connectsToDashboard: true, addToClaude: false, description: "Checkout and payment plans (formerly FanBasis): the cash that actually came in." },
  { name: "Whop", short: "W", category: "Payments", tier: "dashboard", connectsToDashboard: true, addToClaude: false, description: "Checkout, memberships and renewals: the cash that actually came in." },
  { name: "Supabase", short: "Sb", category: "Data and attribution", tier: "dashboard", connectsToDashboard: true, addToClaude: true, description: "Where opt-ins and funnel data land." },
  { name: "Neon", short: "N", category: "Data and attribution", tier: "dashboard", connectsToDashboard: true, addToClaude: true, description: "Serverless Postgres where opt-ins and funnel data land." },
  { name: "Vercel", short: "▲", category: "Data and attribution", tier: "dashboard", connectsToDashboard: true, addToClaude: true, description: "Where the funnel pages live: visits and page metrics." },
  { name: "VTurb", short: "V", category: "Data and attribution", tier: "dashboard", connectsToDashboard: true, addToClaude: false, description: "VSL player: play rate, retention and where viewers drop." },

  // Tier 2 — optional, for your Claude.
  { name: "Other Postgres", short: "Pg", category: "Data and attribution", tier: "claude", connectsToDashboard: true, addToClaude: false, description: "Railway, Render, AWS RDS or any other Postgres database." },
  { name: "Google Sheets", short: "Sh", category: "Data and attribution", tier: "claude", connectsToDashboard: true, addToClaude: true, description: "Scorecards, lead lists and numbers kept in sheets." },
  { name: "Calendly", short: "Ca", category: "CRM", tier: "claude", connectsToDashboard: true, addToClaude: false, description: "Where calls get booked, for teams without GoHighLevel or Close." },
  { name: "n8n", short: "n8", category: "Automations", tier: "claude", connectsToDashboard: true, addToClaude: true, description: "The automations behind the funnel." },
  { name: "GoHighLevel SMS", short: "HL", category: "SMS", tier: "claude", connectsToDashboard: true, addToClaude: false, description: "Reminders and follow-up sent from the CRM." },
  { name: "Roezan", short: "R", category: "SMS", tier: "claude", connectsToDashboard: true, addToClaude: false, description: "Bulk and drip SMS campaigns." },
  { name: "Twilio", short: "Tw", category: "SMS", tier: "claude", connectsToDashboard: true, addToClaude: true, description: "SMS and calls through the Twilio API." },
  { name: "Apify", short: "A", category: "Research and audit", tier: "claude", connectsToDashboard: false, addToClaude: true, description: "Scrapes what the audit and research steps read: Meta Ad Library, comments and reviews on YouTube, Instagram, TikTok, Reddit, Amazon and Trustpilot." },
  { name: "Firecrawl", short: "F", category: "Research and audit", tier: "claude", connectsToDashboard: false, addToClaude: true, description: "Reads any page clean (competitor sites, funnels, sales pages) for audits and teardowns." },
  { name: "Microsoft Clarity", short: "Cy", category: "Research and audit", tier: "claude", connectsToDashboard: true, addToClaude: true, description: "Heatmaps and session recordings: where people scroll, click and leave on each page." },
  { name: "Google Drive", short: "Dr", category: "Docs and files", tier: "claude", connectsToDashboard: true, addToClaude: true, description: "The client folder: creatives, recordings, research and deliverables." },
  { name: "Google Docs", short: "Dc", category: "Docs and files", tier: "claude", connectsToDashboard: true, addToClaude: true, description: "Copy for review: one Doc per creator, a tab per asset (one-pager, VSL, emails)." },
  { name: "Figma", short: "Fi", category: "Design", tier: "claude", connectsToDashboard: false, addToClaude: true, description: "Page, VSL and ad designs: Claude reads the frames and builds or reviews from them." },
];

/** The delivery process every client funnel moves through, from Manos Overview. */
export const DELIVERY_PROCESS = [
  "Research and creator DNA",
  "Offer one-pager (approved)",
  "VSL",
  "Funnel pages",
  "Hooks and ad scripts",
  "Email and SMS sequences",
  "Tracking and automations",
  "Campaign live",
];
