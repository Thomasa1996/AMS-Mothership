"use client";

import { useState, useTransition } from "react";
import { setQuoteDocMarket } from "./doc-actions";
import { OUT_OF_MARKET } from "@/lib/market-forecast";

// The market a quote file's work is in: a picker for its rep or an admin, plain text for everyone else.
export function DocMarket({ id, branchId, markets, canEdit }: { id: string; branchId: string | null; markets: { id: string; name: string }[]; canEdit: boolean }) {
  const [value, setValue] = useState(branchId ?? "");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const name = value === OUT_OF_MARKET ? "Out of market" : markets.find((m) => m.id === value)?.name;
  if (!canEdit) return <span className="text-sm text-slate-600">{name ?? "—"}</span>;
  return (
    <select
      aria-label="Market"
      className={`input w-auto max-w-[10rem] py-1 text-sm ${value ? "" : "text-amber-700"} ${pending ? "opacity-60" : ""} ${error ? "ring-1 ring-red-500" : ""}`}
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        const before = value;
        setValue(next);
        start(async () => {
          const res = await setQuoteDocMarket(id, next).catch(() => ({ error: "failed" }));
          setError(!!res.error);
          if (res.error) setValue(before);
        });
      }}
    >
      <option value="">Pick market</option>
      {markets.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
      <option value={OUT_OF_MARKET}>Out of market</option>
    </select>
  );
}
