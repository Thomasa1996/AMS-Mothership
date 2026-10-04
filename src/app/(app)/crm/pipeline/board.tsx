"use client";

import Link from "next/link";
import { useOptimistic, useTransition, useState } from "react";
import { STAGES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { setProjectStage } from "../actions";

export type BoardProject = {
  id: string;
  name: string;
  stage: string;
  accountName: string;
  moveDate: string | null;
  estimatedValue: number | null;
  managerName: string | null;
};

export function PipelineBoard({ projects }: { projects: BoardProject[] }) {
  const [optimistic, moveOptimistic] = useOptimistic(projects, (state, move: { id: string; stage: string }) =>
    state.map((p) => (p.id === move.id ? { ...p, stage: move.stage } : p)),
  );
  const [, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function move(id: string, stage: string) {
    setError(null);
    startTransition(async () => {
      moveOptimistic({ id, stage });
      try {
        await setProjectStage(id, stage);
      } catch {
        setError("Couldn't move that project. Refresh and try again.");
      }
    });
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const items = optimistic.filter((p) => p.stage === stage.id);
          const total = items.reduce((s, p) => s + (p.estimatedValue ?? 0), 0);
          return (
            <div
              key={stage.id}
              data-stage={stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage.id);
              }}
              onDragLeave={() => setDragOver((s) => (s === stage.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) move(id, stage.id);
              }}
              className={`flex w-64 shrink-0 flex-col rounded-lg border p-2 ${
                dragOver === stage.id ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-slate-100/70"
              }`}
            >
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h3 className="text-sm font-semibold">
                  {stage.label} <span className="font-normal text-slate-400">{items.length}</span>
                </h3>
                <span className="text-xs text-slate-500">{total ? formatCurrency(total) : ""}</span>
              </div>
              <div className="flex min-h-24 flex-col gap-2">
                {items.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
                    className="cursor-grab rounded-md border border-slate-200 bg-surface p-2.5 shadow-sm active:cursor-grabbing"
                  >
                    <Link href={`/crm/projects/${p.id}`} className="block text-sm font-medium text-slate-900 hover:text-brand-600">
                      {p.name}
                    </Link>
                    <div className="text-xs text-slate-500">{p.accountName}</div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-500">{p.moveDate ? formatDate(p.moveDate) : "No date"}</span>
                      <span className="font-medium">{formatCurrency(p.estimatedValue)}</span>
                    </div>
                    <select
                      aria-label="Move to stage"
                      className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-xs text-slate-600 md:hidden"
                      value={p.stage}
                      onChange={(e) => move(p.id, e.target.value)}
                    >
                      {STAGES.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
