import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EcomSimulationSidebar } from "./EcomSimulationSidebar";
import { RangeProvider } from "@/lib/range-context";

export const metadata: Metadata = {
  title: "Ecom Simulation",
  description: "Ecom Simulation dashboard",
  icons: { icon: [] },
  openGraph: { images: [] },
  twitter: { images: [] },
};

export default function EcomSimulationLayout({ children }: { children: ReactNode }) {
  return (
    <RangeProvider>
      <div className="flex min-h-screen flex-col bg-[#F1EEE4] text-black lg:flex-row">
        <EcomSimulationSidebar />
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </RangeProvider>
  );
}
