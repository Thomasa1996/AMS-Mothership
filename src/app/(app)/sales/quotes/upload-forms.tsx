"use client";

import { useState } from "react";
import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";
import { replaceQuotePdf, updateUploadedQuote, uploadQuote } from "./upload-actions";

type Option = { id: string; name: string; accountName?: string };

export function UploadQuoteForm({ projects, markets, projectId }: { projects: Option[]; markets: Option[]; projectId: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(uploadQuote, {});
  const [title, setTitle] = useState(projects.find((p) => p.id === projectId)?.name ?? "");
  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="projectId">Project</label>
          <select
            className="input"
            id="projectId"
            name="projectId"
            defaultValue={projectId}
            required
            onChange={(e) => !title && setTitle(projects.find((p) => p.id === e.target.value)?.name ?? "")}
          >
            <option value="">Pick a project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.accountName}: {p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="title">Quote title</label>
          <input className="input" id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="quoteDate">Quote date</label>
          <input className="input" id="quoteDate" name="quoteDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
        <div>
          <label className="label" htmlFor="total">Quote total ($)</label>
          <input className="input" id="total" name="total" inputMode="decimal" placeholder="86,100.00" required />
        </div>
        {markets.length > 0 && (
          <div>
            <label className="label" htmlFor="branchId">Market (optional)</label>
            <select className="input" id="branchId" name="branchId" defaultValue="">
              <option value="">Standard rates</option>
              {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="file">Quote PDF</label>
          <input id="file" name="file" type="file" accept="application/pdf,.pdf" required className="text-sm" />
          <p className="mt-1 text-xs text-slate-500">In Word, use File, Save As, and pick PDF. Up to 4 MB.</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Uploading..." : "Upload quote"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function ReplacePdfForm({ id }: { id: string }) {
  const { state, onSubmit, pending, ref } = useFormAction<FormState>(replaceQuotePdf.bind(null, id), {}, { resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="file" name="file" accept="application/pdf,.pdf" required className="text-sm" />
      <button className="btn" disabled={pending}>{pending ? "Uploading..." : "Replace PDF"}</button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.ok && <span className="text-sm text-emerald-600">Replaced.</span>}
    </form>
  );
}

export function UploadedDetailsForm({ id, title, quoteDate, total }: { id: string; title: string; quoteDate: string; total: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(updateUploadedQuote.bind(null, id), {});
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="title">Quote title</label>
          <input className="input" id="title" name="title" defaultValue={title} required />
        </div>
        <div>
          <label className="label" htmlFor="quoteDate">Quote date</label>
          <input className="input" id="quoteDate" name="quoteDate" type="date" defaultValue={quoteDate} required />
        </div>
        <div>
          <label className="label" htmlFor="total">Quote total ($)</label>
          <input className="input" id="total" name="total" inputMode="decimal" defaultValue={total} required />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? "Saving..." : "Save details"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">Saved.</span>}
      </div>
    </form>
  );
}
