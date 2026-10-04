"use client";

import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";
import { addReport } from "./actions";

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
