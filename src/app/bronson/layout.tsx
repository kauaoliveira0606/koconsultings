import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BronsonSidebar } from "./BronsonSidebar";
import { RangeProvider } from "@/lib/range-context";

export const metadata: Metadata = {
  title: "Bronson",
  description: "Bronson dashboard",
  icons: { icon: [] },
  openGraph: { images: [] },
  twitter: { images: [] },
};

export default function BronsonLayout({ children }: { children: ReactNode }) {
  return (
    <RangeProvider>
      <div className="flex min-h-screen bg-[#F1EEE4] text-black">
        <BronsonSidebar />
        <main className="flex-1 overflow-x-hidden p-8">{children}</main>
      </div>
    </RangeProvider>
  );
}
