import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RangeProvider } from "@/lib/range-context";

export const metadata: Metadata = {
  title: "Agency",
  description: "KOconsultings agency dashboard",
  icons: { icon: "/icon.png" },
  openGraph: { images: [] },
  twitter: { images: [] },
};

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return (
    // The Agency tab stays open all day: always open on This Month and keep
    // the numbers refreshing on their own.
    <RangeProvider initialPreset="this_month" refreshIntervalMs={60_000}>
      <div
        data-theme="deepspace"
        style={{ background: "var(--app-bg)" }}
        className="min-h-screen text-[var(--text)]"
      >
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </RangeProvider>
  );
}
