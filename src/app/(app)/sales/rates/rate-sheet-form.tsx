"use client";

import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";
import { uploadRateSheet } from "./actions";

export function RateSheetUpload({ market, hasSheet }: { market: string; hasSheet: boolean }) {
  const { state, onSubmit, pending, ref } = useFormAction<FormState>(uploadRateSheet.bind(null, market), {}, { resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="file" name="file" accept="application/pdf,.pdf" required className="text-sm" />
      <button className="btn" disabled={pending}>{pending ? "Uploading..." : hasSheet ? "Replace PDF" : "Upload PDF"}</button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.ok && <span className="text-sm text-emerald-600">Uploaded.</span>}
    </form>
  );
}
