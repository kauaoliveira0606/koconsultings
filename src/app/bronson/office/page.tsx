import { BerlinHeader, Panel } from "@/components/berlin/Berlin";

/** Berlin / Office — a task board for the Bronson room. Empty-state scaffold. */
export default function OfficePage() {
  const columns = [
    { label: "Up next", count: 0, hint: "Queued work" },
    { label: "Doing now", count: 0, hint: "In progress" },
    { label: "Shipped", count: 0, hint: "Done this week" },
  ];
  return (
    <div>
      <BerlinHeader
        title="Office"
        subtitle="The Bronson room: tasks by status. Change status, owner and due date on the row, drag between columns."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {columns.map((col) => (
          <Panel key={col.label}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--text-strong)]">{col.label}</div>
              <span className="rounded-full bg-[var(--panel-subtle)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{col.count}</span>
            </div>
            <div className="mt-3 rounded-md border border-dashed border-[var(--panel-border)] px-3 py-10 text-center text-xs text-[var(--text-muted)]">
              {col.hint}
            </div>
          </Panel>
        ))}
      </div>

      <p className="mt-5 text-xs text-[var(--text-muted)]">
        Task board scaffold. Wire it to a tasks table (Airtable or Neon) to make rows editable and draggable, like the Manos Office.
      </p>
    </div>
  );
}
