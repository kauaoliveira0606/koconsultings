import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BronsonSidebar } from "./BronsonSidebar";
import { RangeProvider } from "@/lib/range-context";

export const metadata: Metadata = {
  title: "Bronson",
  description: "Bronson dashboard",
  icons: { icon: "/icon.png" },
  openGraph: { images: [] },
  twitter: { images: [] },
};

export default function BronsonLayout({ children }: { children: ReactNode }) {
  return (
    <RangeProvider initialPreset="this_month">
      <div
        data-theme="cream"
        style={{ background: "var(--app-bg)" }}
        className="flex min-h-screen flex-col text-[var(--text)] lg:flex-row"
      >
        <BronsonSidebar />
        <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
      </div>
    </RangeProvider>
  );
}
