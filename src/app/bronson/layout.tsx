import type { ReactNode } from "react";
import { BronsonSidebar } from "./BronsonSidebar";

export default function BronsonLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F1EEE4] text-black">
      <BronsonSidebar />
      <main className="flex-1 overflow-x-hidden p-8">{children}</main>
    </div>
  );
}
