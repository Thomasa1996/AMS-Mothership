"use client";

import Link from "next/link";
import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";
import { importBranches, type BranchImportState } from "./actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Status({ state }: { state: FormState }) {
  if (state.error) return <span className="text-sm text-red-600">{state.error}</span>;
  if (state.ok) return <span className="text-sm text-emerald-600">Saved</span>;
  return null;
}

export function BranchImportForm() {
  const { state, onSubmit, pending } = useFormAction<BranchImportState>(importBranches, {});
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="file">Branch profile workbook (.xlsx)</label>
        <input className="input" id="file" name="file" type="file" accept=".xlsx" required />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Importing..." : "Import profiles"}</button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && (
          <p className="text-sm text-emerald-600">
            Imported {state.imported} branches ({state.created} new). <Link href="/warehouse" className="link">View warehouses</Link>
          </p>
        )}
      </div>
    </form>
  );
}

export type Capacity = { warehouseSpace: string; scale: string; warehouseNotes: string; warehouseGrade: string };

export function CapacityForm({ action, defaults, canEdit }: { action: Action; defaults: Capacity; canEdit: boolean }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, {});
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="warehouseSpace">Warehouse space</label>
          <input className="input" id="warehouseSpace" name="warehouseSpace" defaultValue={defaults.warehouseSpace} placeholder="e.g. 8,000 sq. ft. open" />
        </div>
        <div>
          <label className="label" htmlFor="scale">Scale</label>
          <input className="input" id="scale" name="scale" defaultValue={defaults.scale} placeholder="e.g. Can take 2 large projects" />
        </div>
        <div>
          <label className="label" htmlFor="warehouseGrade">Warehouse grade (1 to 5)</label>
          <select className="input" id="warehouseGrade" name="warehouseGrade" defaultValue={defaults.warehouseGrade}>
            <option value="">Not graded</option>
            {[5, 4, 3, 2, 1].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="label" htmlFor="warehouseNotes">Warehouse notes</label>
          <textarea className="input" id="warehouseNotes" name="warehouseNotes" rows={3} defaultValue={defaults.warehouseNotes} />
        </div>
      </fieldset>
      {canEdit && (
        <div className="flex items-center gap-3">
          <button className="btn btn-primary" disabled={pending}>Save</button>
          <Status state={state} />
        </div>
      )}
    </form>
  );
}

export function RepriceForm({ action, labor, storage }: { action: Action; labor: number; storage: number }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, {});
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="labor">Labor and delivery vs standard (%)</label>
        <input className="input w-32" id="labor" name="labor" type="number" step="0.1" defaultValue={labor} />
      </div>
      <div>
        <label className="label" htmlFor="storage">Storage vs standard (%)</label>
        <input className="input w-32" id="storage" name="storage" type="number" step="0.1" defaultValue={storage} />
      </div>
      <button className="btn" disabled={pending}>Reprice every rate</button>
      <Status state={state} />
    </form>
  );
}

export type EditableRate = { id: string; category: string; name: string; unit: string; standard: string; rate: string };

export function MarketRatesForm({ action, rates }: { action: Action; rates: EditableRate[] }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, {});
  const categories = [...new Set(rates.map((r) => r.category))];
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {categories.map((category) => (
        <section key={category} className="card overflow-x-auto">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{category}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Rate</th>
                <th className="text-right">Standard</th>
                <th className="text-right">This market</th>
              </tr>
            </thead>
            <tbody>
              {rates
                .filter((r) => r.category === category)
                .map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.name} <span className="text-xs text-slate-500">/ {r.unit}</span>
                    </td>
                    <td className="whitespace-nowrap text-right text-slate-500">{r.standard}</td>
                    <td className="w-36 text-right">
                      <input
                        className="input py-1 text-right"
                        name={`rate_${r.id}`}
                        defaultValue={r.rate}
                        inputMode="decimal"
                        aria-label={`${r.name} price in this market`}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-slate-200 bg-slate-50 py-3">
        <button className="btn btn-primary" disabled={pending}>Save market rates</button>
        <Status state={state} />
      </div>
    </form>
  );
}
