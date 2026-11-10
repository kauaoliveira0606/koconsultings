/**
 * The source stack Bronson runs on, trimmed to what's actually used (user, 2026-11-10).
 * Two tiers: "dashboard" sources fill the numbers, "claude" sources let the agent act.
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

export const INTEGRATIONS: Integration[] = [
  // Tier 1 — feeds the dashboard.
  { name: "Cortana", short: "Co", category: "Ads", tier: "dashboard", connectsToDashboard: true, addToClaude: true, description: "Attribution: spend, registrations, bookings and cash per campaign, ad set and ad. Feeds the Ads tab." },
  { name: "Airtable", short: "At", category: "Data and attribution", tier: "dashboard", connectsToDashboard: true, addToClaude: true, description: "Where the forms, EODs, post call notes and synced numbers are stored." },
  { name: "WebinarJam", short: "WJ", category: "Webinar", tier: "dashboard", connectsToDashboard: true, addToClaude: false, description: "Webinar registrants, attendance and time in the room." },
  { name: "Meta", short: "f", category: "Ads", tier: "dashboard", connectsToDashboard: true, addToClaude: true, description: "Meta Ads, spend and cost per lead, plus the Pixel and Conversions API." },
  { name: "GoHighLevel", short: "HL", category: "CRM", tier: "dashboard", connectsToDashboard: true, addToClaude: true, description: "Contacts, pipelines, calls booked, shows and closes." },
  { name: "Whop", short: "W", category: "Payments", tier: "dashboard", connectsToDashboard: true, addToClaude: false, description: "Checkout, memberships and renewals: the cash that actually came in." },
  { name: "Supabase", short: "Sb", category: "Data and attribution", tier: "dashboard", connectsToDashboard: true, addToClaude: true, description: "Where opt-ins and funnel data land." },
  { name: "Vercel", short: "▲", category: "Data and attribution", tier: "dashboard", connectsToDashboard: true, addToClaude: true, description: "Where the funnel pages live: visits and page metrics." },
  { name: "VTurb", short: "V", category: "Data and attribution", tier: "dashboard", connectsToDashboard: true, addToClaude: false, description: "VSL player: play rate, retention and where viewers drop." },

  // Tier 2 — optional, for your Claude.
  { name: "Calendly", short: "Ca", category: "CRM", tier: "claude", connectsToDashboard: true, addToClaude: false, description: "Where calls get booked." },
  { name: "n8n", short: "n8", category: "Automations", tier: "claude", connectsToDashboard: true, addToClaude: true, description: "The automations behind the funnel." },
  { name: "Roezan", short: "R", category: "SMS", tier: "claude", connectsToDashboard: true, addToClaude: false, description: "Bulk and drip SMS campaigns." },
  { name: "Microsoft Clarity", short: "Cy", category: "Research and audit", tier: "claude", connectsToDashboard: true, addToClaude: true, description: "Heatmaps and session recordings: where people scroll, click and leave on each page." },
];
