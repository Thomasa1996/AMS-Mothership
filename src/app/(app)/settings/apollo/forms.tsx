"use client";

import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";
import { connectApollo } from "./actions";

export function ApolloKeyForm({ connected }: { connected: boolean }) {
  const { state, onSubmit, pending, ref } = useFormAction<FormState>(connectApollo, {}, { resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="label" htmlFor="key">{connected ? "Replace the API key" : "Apollo master API key"}</label>
        <input className="input font-mono" id="key" name="key" type="password" autoComplete="off" required />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Checking..." : connected ? "Save new key" : "Connect Apollo"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">Connected. Search is under Sales, New Business Development.</span>}
      </div>
    </form>
  );
}
