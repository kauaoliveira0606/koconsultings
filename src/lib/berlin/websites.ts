/**
 * Every website Bronson has (user, 2026-11-10: "the funnel tab = every single
 * website we have for the client"). Pages come from ~/repos/bronson
 * (www.ad-ventur.com, one folder per page); the other Vercel sites are listed
 * at the end. Add a page here when a new one ships.
 */
export type Website = { path: string; name: string; description: string; url?: string };
export type WebsiteGroup = { title: string; description: string; sites: Website[] };

export const SITE_ORIGIN = "https://www.ad-ventur.com";

export const WEBSITE_GROUPS: WebsiteGroup[] = [
  {
    title: "Masterclass funnel",
    description: "The live webinar: registration, order bump, prep and replay.",
    sites: [
      { path: "/masterclass", name: "Masterclass registration (organic)", description: "Live masterclass opt-in: build a subscription e-commerce brand." },
      { path: "/masterclass-paid", name: "Masterclass registration (paid)", description: "Paid-traffic copy of the masterclass opt-in." },
      { path: "/masterclass-confirmation", name: "Masterclass confirmation", description: "\"Wait! Before you go\" page after opt-in, with the $27 order bump." },
      { path: "/masterclass-confirmation-purchase", name: "Order confirmed", description: "Thank-you page after buying the bump." },
      { path: "/masterclass-prep", name: "Masterclass prep", description: "Everything to show up ready for the live masterclass." },
      { path: "/masterclass-replay", name: "Masterclass replay", description: "Replay page for people who missed it live." },
      { path: "/magnet-masterclass", name: "Masterclass download", description: "Lead magnet delivery page." },
    ],
  },
  {
    title: "Main site + application",
    description: "The Inner Table home page and the high-ticket application.",
    sites: [
      { path: "/", name: "Home (The Inner Table)", description: "Main site with the Typeform application." },
      { path: "/application", name: "Book your game plan call", description: "High-ticket application and booking page." },
      { path: "/about", name: "About", description: "About Bronson." },
      { path: "/testimonials", name: "Student wins", description: "Testimonials and results." },
      { path: "/parent", name: "For parents", description: "Page for parents of younger applicants." },
      { path: "/p", name: "The Inner Table (alt)", description: "Alternate landing page." },
      { path: "/close", name: "The Inner Table (close)", description: "Page used on closing calls." },
    ],
  },
  {
    title: "Sales process",
    description: "What a lead sees between booking a call and becoming a student.",
    sites: [
      { path: "/free-resource", name: "Before your call", description: "Pre-call video and program overview." },
      { path: "/pre1on1prep", name: "Call prep", description: "Prep page before the 1-on-1." },
      { path: "/guide", name: "The Opportunity Guide", description: "Full guide to the Inner Table mentorship." },
      { path: "/deposit", name: "Deposit", description: "Deposit checkout page." },
      { path: "/commitment", name: "Commitment", description: "Commitment page." },
      { path: "/the-next-level", name: "The next level", description: "Upsell / next step page." },
    ],
  },
  {
    title: "Students",
    description: "After the sale.",
    sites: [
      { path: "/onboarding", name: "Welcome / onboarding", description: "New student onboarding." },
      { path: "/student-portal", name: "Student portal", description: "Student portal." },
      { path: "/materials", name: "Materials", description: "Program materials." },
    ],
  },
  {
    title: "Lead magnets (Bronson Builds)",
    description: "Free tools: landing page, tool page, and the access page they unlock.",
    sites: [
      { path: "/profit-margin", name: "Profit Margin Calculator", description: "Landing page." },
      { path: "/profit-margin-tool", name: "Profit Margin Calculator (tool)", description: "The calculator." },
      { path: "/profit-margin-access", name: "Profit Margin Calculator (access)", description: "Delivery page." },
      { path: "/product-scorecard", name: "Product Scorecard", description: "Landing page." },
      { path: "/product-scorecard-tool", name: "Product Scorecard (tool)", description: "Rate products on 6 factors." },
      { path: "/product-scorecard-access", name: "Product Scorecard (access)", description: "Delivery page." },
      { path: "/ab-test", name: "A/B Test Calculator", description: "Landing page." },
      { path: "/ab-test-tool", name: "A/B Test Calculator (tool)", description: "Signal or noise checker." },
      { path: "/ab-test-access", name: "A/B Test Calculator (access)", description: "Delivery page." },
      { path: "/brand-name-generator", name: "Brand Name Prompt Pack", description: "Landing page." },
      { path: "/brand-name-generator-tool", name: "Brand Name Prompt Pack (tool)", description: "7 AI prompts." },
      { path: "/brand-name-generator-access", name: "Brand Name Prompt Pack (access)", description: "Delivery page." },
      { path: "/subscription-vs-one-time", name: "Subscription vs One-Time", description: "Landing page." },
      { path: "/subscription-vs-one-time-tool", name: "Subscription vs One-Time (tool)", description: "The breakdown and pricing worksheet." },
      { path: "/subscription-vs-one-time-access", name: "Subscription vs One-Time (access)", description: "Delivery page." },
    ],
  },
  {
    title: "Affiliate funnel (old)",
    description: "Base44 / Wix affiliate pages from before the webinar shift. Letter suffixes are per-setter links.",
    sites: [
      { path: "/lt", name: "Affiliate landing (organic)", description: "Build a successful e-commerce business." },
      { path: "/paid", name: "Affiliate landing (paid)", description: "Paid-traffic copy." },
      { path: "/receiveaccess", name: "You're in (Base44)", description: "Access confirmation." },
      { path: "/base44", name: "We've moved", description: "Old Base44 page, now a moved notice." },
      { path: "/link", name: "Base44 link", description: "Affiliate link page." },
      { path: "/link-E", name: "Base44 link (E)", description: "Setter link." },
      { path: "/link-J", name: "Base44 link (J)", description: "Setter link." },
      { path: "/link-K", name: "Base44 link (K)", description: "Setter link." },
      { path: "/wix", name: "Wix link", description: "Affiliate link page." },
      { path: "/wix-E", name: "Wix link (E)", description: "Setter link." },
      { path: "/wix-J", name: "Wix link (J)", description: "Setter link." },
      { path: "/wix-K", name: "Wix link (K)", description: "Setter link." },
      { path: "/wix-N", name: "Wix link (N)", description: "Setter link." },
    ],
  },
  {
    title: "Team (internal)",
    description: "Scripts and tools for the sales team.",
    sites: [
      { path: "/script", name: "Sales scripts", description: "Script hub." },
      { path: "/setter-script", name: "Setter script", description: "Setter call script." },
      { path: "/closer-script", name: "Closer script", description: "Closer call script." },
      { path: "/sop", name: "3-day workshop SOP", description: "Workshop SOP." },
      { path: "/meta-analysis", name: "Meta ads analysis", description: "Ads analysis page." },
      { path: "/dashboard", name: "Bronson dashboard (old)", description: "Old dashboard page on the site." },
    ],
  },
  {
    title: "Other Bronson sites",
    description: "Separate sites outside ad-ventur.com.",
    sites: [
      { path: "", url: "https://bronson-masterclass.vercel.app", name: "Webinar presenter", description: "The masterclass slides, built from Canva." },
      { path: "", url: "https://youtube-content-bronson.vercel.app", name: "Creator Library", description: "YouTube video briefs for the creator." },
    ],
  },
  {
    title: "Legal",
    description: "",
    sites: [
      { path: "/privacy", name: "Privacy policy", description: "" },
      { path: "/terms", name: "Terms of service", description: "" },
    ],
  },
];

export function siteUrl(s: Website): string {
  return s.url ?? `${SITE_ORIGIN}${s.path}`;
}
