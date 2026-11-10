import type { ReactNode } from "react";

/** Page header used across the Berlin (Manos-style) sections. */
export function BerlinHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold text-[var(--text-strong)]">{title}</h1>
      {subtitle ? <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
    </header>
  );
}

/** A standard panel card matching the dashboard theme tokens. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 ${className}`}>{children}</div>
  );
}

/**
 * Empty-state block for a page whose data engine is not wired yet.
 * Mirrors the Manos "No X numbers yet / ask your Claude" pattern.
 */
export function EmptyState({
  icon,
  title,
  body,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  hint?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--panel-subtle)] px-6 py-14 text-center">
      {icon ? <div className="mb-4 text-[var(--text-muted)]">{icon}</div> : null}
      <div className="text-base font-semibold text-[var(--text-strong)]">{title}</div>
      <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">{body}</p>
      {hint ? (
        <p className="mt-3 max-w-md rounded-md bg-[var(--panel-subtle)] px-3 py-2 text-xs italic text-[var(--text-muted)]">{hint}</p>
      ) : null}
      {action ? (
        <a
          href={action.href}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {action.label}
        </a>
      ) : null}
    </div>
  );
}

/** Small pill tag. */
export function Tag({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "accent" | "muted" }) {
  const tones: Record<string, string> = {
    default: "border-[var(--panel-border)] bg-[var(--panel-subtle)] text-[var(--text)]",
    accent: "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]",
    muted: "border-[var(--panel-border)] bg-transparent text-[var(--text-muted)]",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
