import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BerlinSidebar } from "./BerlinSidebar";
import { AskBerlin } from "@/components/berlin/AskBerlin";
import { cookies } from "next/headers";
import { RangeProvider } from "@/lib/range-context";
import { roleFromCookies } from "@/lib/admin-gate";

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

export default async function BronsonLayout({ children }: { children: ReactNode }) {
  // The proxy already blocks anyone not logged in; this only picks which tabs to list.
  const jar = await cookies();
  const role = (await roleFromCookies((name) => jar.get(name)?.value)) ?? "sales";
  return (
    <RangeProvider initialPreset="this_month">
      <div
        data-theme="cream"
        style={{ background: "var(--app-bg)" }}
        className="flex min-h-screen flex-col text-[var(--text)] lg:flex-row"
      >
        <BerlinSidebar role={role} />
        <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
        {role === "admin" ? <AskBerlin /> : null}
      </div>
    </RangeProvider>
  );
}
