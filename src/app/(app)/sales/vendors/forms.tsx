"use client";

import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/lib/validation";
import { importVendors, type ImportState } from "./actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type VendorDefaults = Partial<
  Record<
    | "category"
    | "name"
    | "memberId"
    | "state"
    | "contactName"
    | "phone"
    | "email"
    | "address"
    | "website"
    | "markets"
    | "verificationStatus"
    | "currentEmployer"
    | "previousContact"
    | "notes",
    string | null
  >
>;

const FIELDS: { name: keyof VendorDefaults; label: string; wide?: boolean }[] = [
  { name: "name", label: "Vendor name" },
  { name: "contactName", label: "Contact name" },
  { name: "phone", label: "Phone" },
  { name: "email", label: "Email" },
  { name: "state", label: "State" },
  { name: "memberId", label: "Member ID" },
  { name: "website", label: "Website" },
  { name: "markets", label: "Markets" },
  { name: "address", label: "Address", wide: true },
  { name: "currentEmployer", label: "Current employer (if changed)" },
  { name: "previousContact", label: "Previous contact" },
];

export function VendorForm({
  action,
  defaults = {},
  categories,
  statuses,
  submitLabel,
}: {
  action: Action;
  defaults?: VendorDefaults;
  categories: string[];
  statuses: string[];
  submitLabel: string;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, {});
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="category">Category</label>
          <input className="input" id="category" name="category" list="vendor-categories" defaultValue={defaults.category ?? ""} required />
          <datalist id="vendor-categories">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="verificationStatus">Verification status</label>
          <input
            className="input"
            id="verificationStatus"
            name="verificationStatus"
            list="vendor-statuses"
            defaultValue={defaults.verificationStatus ?? ""}
          />
          <datalist id="vendor-statuses">
            {statuses.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        {FIELDS.map((f) => (
          <div key={f.name} className={f.wide ? "sm:col-span-2" : ""}>
            <label className="label" htmlFor={f.name}>{f.label}</label>
            <input className="input" id={f.name} name={f.name} defaultValue={defaults[f.name] ?? ""} required={f.name === "name"} />
          </div>
        ))}
      </div>
      <div>
        <label className="label" htmlFor="notes">Notes</label>
        <textarea className="input min-h-20" id="notes" name="notes" defaultValue={defaults.notes ?? ""} />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-emerald-600">Saved</p>}
      </div>
    </form>
  );
}

export function ImportForm() {
  const { state, onSubmit, pending } = useFormAction<ImportState>(importVendors, {});
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="file">Vendor workbook (.xlsx)</label>
        <input className="input" id="file" name="file" type="file" accept=".xlsx" required />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="replace" className="mt-0.5" defaultChecked />
        <span>
          Replace the current vendor list
          <span className="block text-slate-500">Uncheck to add these rows alongside the vendors already here.</span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Importing..." : "Import vendors"}</button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && (
          <p className="text-sm text-emerald-600">
            Imported {state.imported} vendor contacts across {state.categories} categories.{" "}
            <a href="/sales/vendors" className="link">View vendors</a>
          </p>
        )}
      </div>
    </form>
  );
}
