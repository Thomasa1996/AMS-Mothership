"use client";

import { useState } from "react";
import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Status({ state }: { state: FormState }) {
  if (state.error) return <span className="text-sm text-red-600">{state.error}</span>;
  if (state.ok) return <span className="text-sm text-emerald-600">Saved</span>;
  return null;
}

export type RateRow = { id: string; category: string; name: string; unit: string; rate: string; notes: string; active: boolean };

export function RateRowForm({ action, row, categories }: { action: Action; row?: RateRow; categories: string[] }) {
  const { state, onSubmit, pending, ref } = useFormAction<FormState>(action, {}, { resetOnSuccess: !row });
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid grid-cols-2 items-start gap-2 md:grid-cols-[1.2fr_1.6fr_0.9fr_0.7fr_1.6fr_auto_auto]">
      <input className="input" name="category" list="rate-categories" defaultValue={row?.category} placeholder="Category" required aria-label="Category" />
      <input className="input" name="name" defaultValue={row?.name} placeholder="Name" required aria-label="Name" />
      <input className="input" name="unit" defaultValue={row?.unit} placeholder="hour" required aria-label="Unit" />
      <input className="input" name="rate" defaultValue={row?.rate} placeholder="0.00" inputMode="decimal" required aria-label="Rate in dollars" />
      <input className="input" name="notes" defaultValue={row?.notes} placeholder="Notes" aria-label="Notes" />
      {row ? (
        <label className="flex items-center gap-1 pt-1.5 text-xs text-slate-600">
          <input type="checkbox" name="active" defaultChecked={row.active} /> Active
        </label>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <button className="btn py-1" disabled={pending}>{row ? "Save" : "Add rate"}</button>
        <Status state={state} />
      </div>
      {!row && (
        <datalist id="rate-categories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      )}
    </form>
  );
}

export function NotesForm({ action, name, defaultValue, label, rows = 6 }: { action: Action; name: string; defaultValue: string; label: string; rows?: number }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, {});
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label className="label" htmlFor={name}>{label}</label>
      <textarea className="input" id={name} name={name} rows={rows} defaultValue={defaultValue} />
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>Save</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function ImageInput({ name, label, defaultValue, hint }: { name: string; label: string; defaultValue: string | null; hint?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <label className="label">{label}</label>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-14 max-w-56 rounded border border-slate-200 bg-white object-contain p-1" />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 500 * 1024) return setError("Choose an image under 500 KB");
            setError(null);
            const reader = new FileReader();
            reader.onload = () => setValue(String(reader.result));
            reader.readAsDataURL(file);
          }}
        />
        {value && (
          <button type="button" className="text-sm text-slate-500 hover:text-red-600" onClick={() => setValue("")}>
            Remove
          </button>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function SettingsForm({ action, children, submitLabel = "Save" }: { action: Action; children: React.ReactNode; submitLabel?: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, {});
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {children}
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
        <Status state={state} />
      </div>
    </form>
  );
}
