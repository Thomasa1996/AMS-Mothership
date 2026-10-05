"use client";

import { useState } from "react";
import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";
import { SMARTSHEET_REGIONS } from "@/lib/smartsheet";
import { useRouter } from "next/navigation";
import { IMPORT_FIELDS } from "@/lib/smartsheet-fields";
import { connectSmartsheet, importNow, saveImportConfig, saveSheetChoice } from "./actions";

export function ConnectForm({ connected, region }: { connected: boolean; region: string }) {
  const { state, onSubmit, pending, ref } = useFormAction<FormState>(connectSmartsheet, {}, { resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="region">Which Smartsheet</label>
          <select className="input" id="region" name="region" defaultValue={region}>
            {SMARTSHEET_REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="token">{connected ? "Replace the API token" : "API access token"}</label>
          <input className="input font-mono" id="token" name="token" type="password" autoComplete="off" required />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Checking..." : connected ? "Save new token" : "Connect Smartsheet"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">Connected. Your sheets are under Operations, Remote control.</span>}
      </div>
    </form>
  );
}

export function SheetChoiceForm({ sheets, chosen }: { sheets: { id: string; name: string }[]; chosen: string[] }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveSheetChoice, {});
  const [all, setAll] = useState(chosen.length === 0);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="all" checked={all} onChange={(e) => setAll(e.target.checked)} />
        Show every sheet
      </label>
      {!all && (
        <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-md border border-slate-200 p-3">
          {sheets.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="sheet" value={s.id} defaultChecked={chosen.includes(s.id)} />
              {s.name}
            </label>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : "Save"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">Saved.</span>}
      </div>
    </form>
  );
}

export function ImportForm({
  sheets,
  sheetId,
  columns,
  mapping,
  saved,
}: {
  sheets: { id: string; name: string }[];
  sheetId: string;
  columns: { id: string; title: string }[];
  mapping: Partial<Record<string, string>>;
  saved: boolean;
}) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction<FormState>(saveImportConfig, {});
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="sheetId">Sheet your projects are in</label>
        <select
          className="input"
          id="sheetId"
          name="sheetId"
          value={sheetId}
          onChange={(e) => router.push(`/settings/smartsheet?importSheet=${e.target.value}`)}
        >
          <option value="">Choose a sheet</option>
          {sheets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {sheetId && columns.length > 0 && (
        <>
          <p className="text-sm text-slate-500">Match each CRM field to the column that holds it. Fields left on &quot;Not in this sheet&quot; are skipped.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {IMPORT_FIELDS.map((f) => (
              <div key={f.id}>
                <label className="label" htmlFor={`f-${f.id}`}>{f.label}{"required" in f && f.required ? "" : " (optional)"}</label>
                <select className="input" id={`f-${f.id}`} name={f.id} defaultValue={mapping[f.id] ?? ""}>
                  <option value="">Not in this sheet</option>
                  {columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" disabled={pending}>{pending ? "Importing..." : saved ? "Save and import now" : "Start importing"}</button>
            {state.error && <span className="text-sm text-red-600">{state.error}</span>}
            {state.ok && <span className="text-sm text-emerald-600">Saved and imported.</span>}
          </div>
        </>
      )}
    </form>
  );
}

export function ImportNowButton() {
  const { state, onSubmit, pending } = useFormAction<FormState>(importNow, {});
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-3">
      <button className="btn" disabled={pending}>{pending ? "Importing..." : "Import now"}</button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.ok && <span className="text-sm text-emerald-600">Done.</span>}
    </form>
  );
}
