"use client";

import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";
import type { Field } from "@/lib/powerbi-api";
import { connectPowerBi, saveRevenueSource, syncPowerBiNow } from "./actions";

export function ConnectForm({ tenantId, clientId, connected }: { tenantId: string; clientId: string; connected: boolean }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(connectPowerBi, {});
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="tenantId">Directory (tenant) ID</label>
          <input className="input font-mono" id="tenantId" name="tenantId" defaultValue={tenantId} autoComplete="off" required />
        </div>
        <div>
          <label className="label" htmlFor="clientId">Application (client) ID</label>
          <input className="input font-mono" id="clientId" name="clientId" defaultValue={clientId} autoComplete="off" required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="secret">{connected ? "Client secret (leave blank to keep the saved one)" : "Client secret value"}</label>
        <input className="input font-mono" id="secret" name="secret" type="password" autoComplete="off" required={!connected} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Checking..." : connected ? "Save" : "Connect Power BI"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">Connected.</span>}
      </div>
    </form>
  );
}

// Fields are free text with suggestions from the dataset, so a measure can also be typed by name
// (as [Commercial Revenue]) when Power BI won't list them.
export function RevenueForm({
  groupId,
  datasetId,
  dates,
  amounts,
  current,
}: {
  groupId: string;
  datasetId: string;
  dates: Field[];
  amounts: Field[];
  current: { dateColumn: string; series: { name: string; amount: string }[] };
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveRevenueSource, {});
  const rows = [...current.series, ...Array.from({ length: Math.max(0, 5 - current.series.length) }, () => ({ name: "", amount: "" }))].slice(0, 5);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="datasetId" value={datasetId} />
      <datalist id="pbi-dates">{dates.map((f) => <option key={f.ref} value={f.ref}>{f.label}</option>)}</datalist>
      <datalist id="pbi-amounts">{amounts.map((f) => <option key={f.ref} value={f.ref}>{f.label}</option>)}</datalist>
      <div>
        <label className="label" htmlFor="dateColumn">Date to group by month</label>
        <input className="input font-mono text-sm" id="dateColumn" name="dateColumn" list="pbi-dates" defaultValue={current.dateColumn} placeholder="'Date'[Date]" />
        <p className="mt-1 text-xs text-slate-500">Usually the Date column of your date table, or the invoice or close date.</p>
      </div>
      <div>
        <div className="label">Revenue lines</div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[14rem_1fr]">
              <input className="input" name={`name${i}`} defaultValue={r.name} placeholder="Name shown in Mothership" aria-label={`Line ${i + 1} name`} />
              <input className="input font-mono text-sm" name={`amount${i}`} list="pbi-amounts" defaultValue={r.amount} placeholder="[Measure name]" aria-label={`Line ${i + 1} measure`} />
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">Pick the measure your report uses for each line. Leave a row blank to skip it.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Reading Power BI..." : "Save and read revenue"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">Done. See Revenue › Year over year.</span>}
      </div>
    </form>
  );
}

export function SyncNowButton() {
  const { state, onSubmit, pending } = useFormAction<FormState>(syncPowerBiNow, {});
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <button className="btn" disabled={pending}>{pending ? "Reading..." : "Read now"}</button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.ok && <span className="text-sm text-emerald-600">Updated.</span>}
    </form>
  );
}
