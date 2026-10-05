"use client";

import { useFormAction } from "@/lib/use-form-action";
import { ACCEPTED_FILES } from "@/lib/file-upload";
import type { FormState } from "@/lib/validation";
import { addQuoteTemplate } from "./actions";

export function AddTemplateForm() {
  const { state, onSubmit, pending, ref } = useFormAction<FormState>(addQuoteTemplate, {}, { resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input className="input" id="name" name="name" placeholder="Leave blank to use the file name" />
        </div>
        <div>
          <label className="label" htmlFor="file">File</label>
          <input className="text-sm" id="file" name="file" type="file" accept={ACCEPTED_FILES} required />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">When to use it (optional)</label>
          <input className="input" id="description" name="description" placeholder="e.g. Office relocations over 50 people" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Uploading..." : "Add template"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">Added.</span>}
      </div>
    </form>
  );
}
