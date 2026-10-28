"use client";

import { DashboardSidebar, type SidebarSection } from "@/components/dashboard/DashboardSidebar";

/** Same structure as Aval (user, 2026-10-28): Reactivation and Webinars are their own dashboards. */
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
  { label: "Reactivation", items: [{ href: "/bronson/reactivation", label: "Reactivation" }] },
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
  return <DashboardSidebar initials="BR" name="Bronson (The Inner Table)" logo="/brand/bronson-logo.png" sections={SECTIONS} />;
}
