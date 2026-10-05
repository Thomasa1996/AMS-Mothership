"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/lib/validation";
import { MONTHS } from "@/lib/revenue";
import { saveRevenueMonths } from "./actions";

// Twelve monthly totals for one year. Pasting a column of 12 numbers (from Excel) into any box fills the rest.
export function RevenueMonthsForm({ years, values }: { years: number[]; values: Record<number, (number | null)[]> }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveRevenueMonths, {});
  const [year, setYear] = useState(years[0]);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const onPaste = (start: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    const parts = e.clipboardData.getData("text").split(/[\r\n\t]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return;
    e.preventDefault();
    parts.slice(0, 12 - start).forEach((p, i) => {
      const input = formRef.current?.elements.namedItem(`m${start + i + 1}`) as HTMLInputElement | null;
      if (input) input.value = p;
    });
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" key={year}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm" htmlFor="year">Year</label>
        <select id="year" name="year" className="input w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-sm text-slate-500">Leave a month blank to use won deals in Mothership for it.</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {MONTHS.map((m, i) => (
          <div key={m}>
            <label className="label" htmlFor={`m${i + 1}`}>{m}</label>
            <input
              className="input tabular-nums"
              id={`m${i + 1}`}
              name={`m${i + 1}`}
              inputMode="decimal"
              placeholder="$0"
              defaultValue={values[year]?.[i] != null ? `$${values[year][i]!.toLocaleString()}` : ""}
              onPaste={onPaste(i)}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : `Save ${year} totals`}</button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-emerald-600">Saved</p>}
      </div>
    </form>
  );
}
