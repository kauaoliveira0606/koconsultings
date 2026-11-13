"use client";

import { ShowRateSection } from "@/components/dashboard/ShowRateSection";

/** Masterclass registrants: the AI texts back as Bronson to get them to show up live (user, 2026-10-28). */
export default function ShowRatePage() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Show Rate</h1>
      </div>
      <ShowRateSection offer="bronson" />
    </div>
  );
}
