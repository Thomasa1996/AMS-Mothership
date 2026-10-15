"use client";

import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";
import { readMissingTotals } from "./doc-actions";

// Shown while some files were added before Mothership read totals from them.
export function ReadTotalsButton({ count }: { count: number }) {
  const { state, onSubmit, pending } = useFormAction<FormState & { message?: string }>(readMissingTotals, {});
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <button className="btn" disabled={pending}>
        {pending ? "Reading files..." : `Read totals from ${count} earlier ${count === 1 ? "file" : "files"}`}
      </button>
      {state.message && <span className="text-sm text-slate-600">{state.message}</span>}
    </form>
  );
}
