"use client";

import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";
import { addTraining } from "./actions";

export function AddTrainingForm({ categories }: { categories: string[] }) {
  const { state, onSubmit, pending, ref } = useFormAction<FormState>(addTraining, {}, { resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input className="input" id="title" name="title" required maxLength={200} placeholder="Walkthrough checklist" />
        </div>
        <div>
          <label className="label" htmlFor="category">Section</label>
          <input className="input" id="category" name="category" list="training-categories" maxLength={80} placeholder="Sales, Safety, Mothership how-to" />
          <datalist id="training-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="description">What it covers (optional)</label>
        <textarea className="input" id="description" name="description" rows={2} maxLength={2000} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="file">PDF (up to 4 MB)</label>
          <input className="input" id="file" name="file" type="file" accept="application/pdf,.pdf" />
        </div>
        <div>
          <label className="label" htmlFor="url">Or a link (video, SharePoint, website)</label>
          <input className="input" id="url" name="url" placeholder="https://..." />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Adding..." : "Add training"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">Added.</span>}
      </div>
    </form>
  );
}
