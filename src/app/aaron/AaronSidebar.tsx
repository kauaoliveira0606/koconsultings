"use client";

import { DashboardSidebar, type SidebarSection } from "@/components/dashboard/DashboardSidebar";

const SECTIONS: SidebarSection[] = [
  {
    label: "Dashboard",
    items: [
      { href: "/aaron/overview", label: "Overview" },
      { href: "/aaron/scorecard", label: "Scorecard" },
      { href: "/aaron/cash-calendar", label: "Cash Calendar" },
      { href: "/aaron/sales-team", label: "Sales Team" },
      { href: "/aaron/knowledge-base", label: "Knowledge Base" },
      { href: "/aaron/live-calls", label: "Live Calls" },
      { href: "/aaron/payment-plans", label: "Payment Plans" },
      { href: "/aaron/upsell-potential", label: "Upsell Potential" },
      { href: "/aaron/models", label: "Models" },
      { href: "/aaron/admin-team", label: "Admin Team" },
    ],
  },
];

export function AaronSidebar() {
  return <DashboardSidebar initials="AT" name="Aaron (SetterHQ)" logo="/brand/aaron-logo.png" sections={SECTIONS} />;
}
