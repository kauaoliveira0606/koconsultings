"use client";

import { DashboardSidebar, type SidebarSection } from "@/components/dashboard/DashboardSidebar";

/**
 * Berlin shell over the Bronson dashboard. The top switcher is each section;
 * the Manos-style sections (Ads, Funnel, Integrations, Office) sit alongside the
 * existing dashboard tabs. Reactivation retired (user, 2026-11-09).
 */
const SECTIONS: SidebarSection[] = [
  {
    label: "Dashboard",
    items: [
      { href: "/bronson/overview", label: "Overview" },
      { href: "/bronson/scorecard", label: "Scorecard" },
      { href: "/bronson/cash-calendar", label: "Cash Calendar" },
      { href: "/bronson/sales-team", label: "Sales Team" },
      { href: "/bronson/knowledge-base", label: "Knowledge Base" },
      { href: "/bronson/live-calls", label: "Live Calls" },
      { href: "/bronson/payment-plans", label: "Payment Plans" },
      { href: "/bronson/upsell-potential", label: "Upsell Potential" },
      { href: "/bronson/models", label: "Models" },
      { href: "/bronson/admin-team", label: "Admin Team" },
    ],
  },
  {
    label: "Ads",
    items: [
      { href: "/bronson/ads", label: "Ads" },
      { href: "/bronson/ads/campaigns", label: "Campaigns" },
      { href: "/bronson/ad-formats", label: "Ad Formats" },
    ],
  },
  { label: "Funnel", items: [{ href: "/bronson/funnels", label: "Funnels" }] },
  { label: "Integrations", items: [{ href: "/bronson/integrations", label: "Integrations" }] },
  {
    label: "Webinars",
    items: [
      { href: "/bronson/webinars", label: "Webinars" },
      { href: "/bronson/show-rate", label: "Show Rate" },
      { href: "/bronson/no-shows", label: "No-Shows" },
    ],
  },
];

export function BronsonSidebar() {
  return <DashboardSidebar initials="BR" name="Berlin" logo="/brand/bronson-logo.png" sections={SECTIONS} />;
}
