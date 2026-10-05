"use client";

import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";
import { addReport, saveRepReport } from "./actions";

export function AddReportForm() {
  const { state, onSubmit, pending, ref } = useFormAction<FormState>(addReport, {}, { resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
        <div>
          <label className="label" htmlFor="name">Report name</label>
          <input className="input" id="name" name="name" placeholder="Sales pipeline" required />
        </div>
        <div>
          <label className="label" htmlFor="link">Power BI embed link</label>
          <input className="input font-mono" id="link" name="link" placeholder="https://app.powerbi.com/reportEmbed?reportId=..." required />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Adding..." : "Add report"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">Added.</span>}
      </div>
    </form>
  );
}

export function RepReportForm({ userId, current }: { userId: string; current: string | null }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveRepReport.bind(null, userId), {});
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label className="label" htmlFor={`link-${userId}`}>{current ? "Change the SharePoint link" : "SharePoint link to this rep's report"}</label>
      <div className="flex flex-wrap gap-2">
        <input className="input min-w-0 flex-1" id={`link-${userId}`} name="link" defaultValue={current ?? ""} placeholder="https://applemoving.sharepoint.com/..." />
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : "Save"}</button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-600">Saved.</p>}
    </form>
  );
}
