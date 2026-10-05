"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { MONTHS } from "@/lib/revenue";
import { pasteRevenue, saveRevenueMonths, uploadRevenueFile, type SaveState } from "./actions";

function useSaved(state: SaveState) {
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
}

function YearSelect({ years, defaultValue, id }: { years: number[]; defaultValue: number; id: string }) {
  return (
    <select id={id} name="year" className="input w-auto" defaultValue={defaultValue}>
      {years.map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}

function Result({ state }: { state: SaveState }) {
  if (state.error) return <span className="text-sm text-red-600">{state.error}</span>;
  if (state.ok) return <span className="text-sm text-emerald-600">{state.message}</span>;
  return null;
}

export function PasteRevenueForm({ years, defaultYear }: { years: number[]; defaultYear: number }) {
  const { state, onSubmit, pending, ref } = useFormAction<SaveState>(pasteRevenue, {}, { resetOnSuccess: true });
  useSaved(state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm" htmlFor="paste-year">Year</label>
        <YearSelect id="paste-year" years={years} defaultValue={defaultYear} />
        <span className="text-sm text-slate-500">Used when the table has no Year column.</span>
      </div>
      <textarea
        className="input min-h-40 font-mono text-xs"
        name="text"
        placeholder={"Category\tMonth\tType\tSum of Amount\nCommercial Revenue\tJan\tActual Rev\t249,081\nCommercial Revenue\tJan\tCorporate Account\t34,731"}
        required
      />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : "Save"}</button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function UploadRevenueForm({ years, defaultYear }: { years: number[]; defaultYear: number }) {
  const { state, onSubmit, pending, ref } = useFormAction<SaveState>(uploadRevenueFile, {}, { resetOnSuccess: true });
  useSaved(state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input className="input max-w-sm" name="file" type="file" accept=".xlsx,.csv" required />
      <YearSelect id="upload-year" years={years} defaultValue={defaultYear} />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Reading..." : "Upload"}</button>
      <Result state={state} />
    </form>
  );
}

// Twelve monthly totals for one line and year. Pasting a column of 12 numbers into any box fills the rest.
export function RevenueMonthsForm({ lines, years, values }: { lines: string[]; years: number[]; values: Record<string, (number | null)[]> }) {
  const { state, onSubmit, pending } = useFormAction<SaveState>(saveRevenueMonths, {});
  useSaved(state);
  const [series, setSeries] = useState(lines[0]);
  const [year, setYear] = useState(years[0]);
  const formRef = useRef<HTMLFormElement>(null);
  const current = values[`${series}|${year}`] ?? [];

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
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" key={`${series}|${year}`}>
      <div className="flex flex-wrap items-center gap-3">
        <select name="series" className="input w-auto" value={series} onChange={(e) => setSeries(e.target.value)} aria-label="Revenue line">
          {lines.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select name="year" className="input w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-sm text-slate-500">Leave a month blank to clear it.</span>
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
              defaultValue={current[i] != null ? `$${current[i]!.toLocaleString()}` : ""}
              onPaste={onPaste(i)}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : `Save ${series} ${year}`}</button>
        <Result state={state} />
      </div>
    </form>
  );
}
