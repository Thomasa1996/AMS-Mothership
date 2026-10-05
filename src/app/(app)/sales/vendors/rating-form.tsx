"use client";

import { useState } from "react";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/lib/validation";
import { RATING_CRITERIA, gradeFor, overall, type Scores } from "@/lib/vendor-grade";
import { GradeBadge } from "./grade-badge";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

const WORDS = ["", "Poor", "Below par", "OK", "Good", "Excellent"];

export function RatingForm({ action, defaults }: { action: Action; defaults: (Scores & { comment: string | null }) | null }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, {});
  const [scores, setScores] = useState<Partial<Scores>>(defaults ?? {});
  const complete = RATING_CRITERIA.every((c) => scores[c.id]);
  const grade = complete ? gradeFor(overall(scores as Scores)) : null;
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {RATING_CRITERIA.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">{c.label}</span>
          <div className="flex items-center gap-1">
            <input type="hidden" name={c.id} value={scores[c.id] ?? ""} />
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${c.label}: ${n} of 5`}
                title={WORDS[n]}
                onClick={() => setScores((s) => ({ ...s, [c.id]: n }))}
                className={`text-xl leading-none ${n <= (scores[c.id] ?? 0) ? "text-[#f59e0b]" : "text-slate-300 hover:text-[#fbbf24]"}`}
              >
                ★
              </button>
            ))}
            <span className="w-20 text-right text-xs text-slate-500">{WORDS[scores[c.id] ?? 0]}</span>
          </div>
        </div>
      ))}
      <textarea className="input min-h-16" name="comment" placeholder="What should the team know? (optional)" defaultValue={defaults?.comment ?? ""} />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending || !complete}>
          {pending ? "Saving..." : defaults ? "Update my rating" : "Save my rating"}
        </button>
        {grade && (
          <span className="text-sm text-slate-500">
            Your grade: <GradeBadge grade={grade} />
          </span>
        )}
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-emerald-600">Saved</p>}
      </div>
    </form>
  );
}

