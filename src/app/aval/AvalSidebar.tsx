"use client";

import { DashboardSidebar, type SidebarSection } from "@/components/dashboard/DashboardSidebar";

/** User, 2026-10-28: Reactivation and Webinars are their own dashboards, switched at the top left. */
const SECTIONS: SidebarSection[] = [
  {
    label: "Dashboard",
    items: [
      { href: "/aval/overview", label: "Overview" },
      { href: "/aval/scorecard", label: "Scorecard" },
      { href: "/aval/cash-calendar", label: "Cash Calendar" },
      { href: "/aval/sales-team", label: "Sales Team" },
      { href: "/aval/knowledge-base", label: "Knowledge Base" },
      { href: "/aval/live-calls", label: "Live Calls" },
      { href: "/aval/payment-plans", label: "Payment Plans" },
      { href: "/aval/upsell-potential", label: "Upsell Potential" },
      { href: "/aval/models", label: "Models" },
      { href: "/aval/admin-team", label: "Admin Team" },
    ],
  },
  { label: "Reactivation", items: [{ href: "/aval/reactivation", label: "Reactivation" }] },
  {
    label: "Webinars",
    items: [
      { href: "/aval/webinars", label: "Webinars" },
      { href: "/aval/show-rate", label: "Show Rate" },
      { href: "/aval/no-shows", label: "No-Shows" },
    ],
  },
];

export function AvalSidebar() {
  return <DashboardSidebar initials="AV" name="Aval (Mind Over Market)" logo="/brand/aval-logo.png" sections={SECTIONS} />;
}
