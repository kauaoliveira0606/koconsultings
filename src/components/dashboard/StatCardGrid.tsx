import type { ReactNode } from "react";

export function StatCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {children}
    </div>
  );
}

export function DashboardSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-12 first:mt-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="h-5 w-1 rounded-full bg-gradient-to-b from-sky-300 to-indigo-400" />
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text-strong)]">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
