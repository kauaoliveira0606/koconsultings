import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
};

export function DataTable<T>({
  columns,
  rows,
  emptyMessage = "No data yet.",
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  rowKey: (row: T, index: number) => string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-black/10 bg-white p-6 text-center text-sm text-black/50">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase text-black/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 ${col.align === "right" ? "text-right" : "text-left"}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="border-b border-black/5 last:border-0">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 ${col.align === "right" ? "text-right" : "text-left"}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
