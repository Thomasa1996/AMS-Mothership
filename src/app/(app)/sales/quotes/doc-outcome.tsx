"use client";

import { useState, useTransition } from "react";
import { setQuoteDocOutcome } from "./doc-actions";

const STYLE: Record<string, string> = {
  WON: "bg-emerald-100 text-emerald-800",
  LOST: "bg-red-100 text-red-800",
  "": "bg-slate-100 text-slate-600",
};
const LABEL: Record<string, string> = { WON: "Won", LOST: "Lost", "": "Open" };

// Won, Lost or Open for a quote file: a picker for its rep or an admin, a badge for everyone else.
export function DocOutcome({ id, outcome, canEdit }: { id: string; outcome: string | null; canEdit: boolean }) {
  const [value, setValue] = useState(outcome ?? "");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  if (!canEdit) return <span className={`badge ${STYLE[value]}`}>{LABEL[value]}</span>;
  return (
    <select
      aria-label="Won or lost"
      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${STYLE[value]} ${pending ? "opacity-60" : ""} ${error ? "ring-1 ring-red-500" : ""}`}
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        const before = value;
        setValue(next);
        start(async () => {
          const res = await setQuoteDocOutcome(id, next).catch(() => ({ error: "failed" }));
          setError(!!res.error);
          if (res.error) setValue(before);
        });
      }}
    >
      <option value="">Open</option>
      <option value="WON">Won</option>
      <option value="LOST">Lost</option>
    </select>
  );
}
