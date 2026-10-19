"use client";

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";

const NAV_ITEMS = [
  { href: "/aval/overview", label: "Overview" },
  { href: "/aval/webinars", label: "Webinars" },
  { href: "/aval/scorecard", label: "Scorecard" },
  { href: "/aval/cash-calendar", label: "Cash Calendar" },
  { href: "/aval/sales-team", label: "Sales Team" },
  { href: "/aval/knowledge-base", label: "Knowledge Base" },
  { href: "/aval/live-calls", label: "Live Calls" },
  { href: "/aval/payment-plans", label: "Payment Plans" },
  { href: "/aval/upsell-potential", label: "Upsell Potential" },
  { href: "/aval/models", label: "Models" },
  { href: "/aval/admin-team", label: "Admin Team" },
];

export function AvalSidebar() {
  return <DashboardSidebar initials="AV" name="Aval" items={NAV_ITEMS} />;
}
