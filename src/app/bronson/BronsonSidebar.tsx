"use client";

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";

const NAV_ITEMS = [
  { href: "/bronson/overview", label: "Overview" },
  { href: "/bronson/webinars", label: "Webinars" },
  { href: "/bronson/reactivation", label: "Reactivation" },
  { href: "/bronson/scorecard", label: "Scorecard" },
  { href: "/bronson/cash-calendar", label: "Cash Calendar" },
  { href: "/bronson/sales-team", label: "Sales Team" },
  { href: "/bronson/knowledge-base", label: "Knowledge Base" },
  { href: "/bronson/live-calls", label: "Live Calls" },
  { href: "/bronson/payment-plans", label: "Payment Plans" },
  { href: "/bronson/upsell-potential", label: "Upsell Potential" },
  { href: "/bronson/models", label: "Models" },
  { href: "/bronson/admin-team", label: "Admin Team" },
];

export function BronsonSidebar() {
  return <DashboardSidebar initials="BR" name="Bronson" items={NAV_ITEMS} />;
}
