import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BerlinSidebar } from "./BerlinSidebar";
import { RangeProvider } from "@/lib/range-context";

export const metadata: Metadata = {
  title: "Berlin",
  description: "One view of your marketing funnels, performance, and pacing.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.png", apple: "/brand/berlin-apple-touch.png" },
  appleWebApp: { capable: true, title: "Berlin", statusBarStyle: "black-translucent" },
  openGraph: { images: [] },
  twitter: { images: [] },
};

export const viewport = {
  themeColor: "#000000",
};

export default function BronsonLayout({ children }: { children: ReactNode }) {
  return (
    <RangeProvider initialPreset="this_month">
      <div
        data-theme="cream"
        style={{ background: "var(--app-bg)" }}
        className="flex min-h-screen flex-col text-[var(--text)] lg:flex-row"
      >
        <BerlinSidebar />
        <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
      </div>
    </RangeProvider>
  );
}
