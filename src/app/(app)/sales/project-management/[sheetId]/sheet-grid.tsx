"use client";

import { useMemo, useState } from "react";
import type { TableRow } from "@/lib/smartsheet";

export function SheetGrid({ columns, rows }: { columns: { title: string; primary: boolean }[]; rows: TableRow[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? rows.filter((r) => r.cells.some((c) => c.toLowerCase().includes(term))) : rows;
  }, [q, rows]);
  return (
    <div className="space-y-3">
      <input className="input max-w-sm" placeholder="Search this sheet" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card max-h-[70vh] overflow-auto">
        <table className="table whitespace-nowrap">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-10 text-right">#</th>
              {columns.map((c, i) => <th key={i}>{c.title}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, n) => (
              <tr key={r.id}>
                <td className="text-right text-xs text-slate-400">{q ? "" : n + 1}</td>
                {r.cells.map((cell, i) => (
                  <td
                    key={i}
                    className={columns[i]?.primary ? "font-medium" : "text-slate-700"}
                    style={columns[i]?.primary && r.depth ? { paddingLeft: `${0.75 + r.depth * 1.25}rem` } : undefined}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="p-4 text-sm text-slate-500">No rows match.</p>}
      </div>
    </div>
  );
}
