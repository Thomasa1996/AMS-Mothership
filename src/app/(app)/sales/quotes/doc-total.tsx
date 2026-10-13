"use client";

import { useState, useTransition } from "react";
import { setQuoteDocTotal } from "./doc-actions";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

// A quote file's total, shown as a button that turns into a box to type it in.
export function DocTotal({ id, cents, canEdit }: { id: string; cents: number | null; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!canEdit) return <span className="tabular-nums">{cents === null ? "—" : money(cents)}</span>;
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className={cents === null ? "text-sm text-amber-700 hover:underline" : "tabular-nums hover:underline"} title="Change the total">
        {cents === null ? "Add total" : money(cents)}
      </button>
    );
  }
  return (
    <form
      className="inline-flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const value = String(new FormData(e.currentTarget).get("total") ?? "");
        start(async () => {
          const res = await setQuoteDocTotal(id, value);
          if (res.error) setError(res.error);
          else {
            setError(null);
            setEditing(false);
          }
        });
      }}
    >
      <input className="input w-28 py-1 text-right" name="total" defaultValue={cents === null ? "" : (cents / 100).toFixed(2)} placeholder="$" autoFocus aria-label="Total" />
      <button className="btn py-1" disabled={pending}>{pending ? "..." : "Save"}</button>
      <button type="button" className="text-xs text-slate-500" onClick={() => setEditing(false)}>Cancel</button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
