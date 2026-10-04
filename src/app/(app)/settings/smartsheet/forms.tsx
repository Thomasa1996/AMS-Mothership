"use client";

import { useState } from "react";
import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";
import { SMARTSHEET_REGIONS } from "@/lib/smartsheet";
import { connectSmartsheet, saveSheetChoice } from "./actions";

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
        {state.ok && <span className="text-sm text-emerald-600">Connected. Your sheets are under Sales, Project management.</span>}
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
