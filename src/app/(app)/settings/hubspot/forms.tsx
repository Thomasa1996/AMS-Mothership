"use client";

import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";
import { connectHubSpot, syncHubSpotNow } from "./actions";

export function ConnectForm({ connected }: { connected: boolean }) {
  const { state, onSubmit, pending, ref } = useFormAction<FormState>(connectHubSpot, {}, { resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="label" htmlFor="token">{connected ? "Replace the HubSpot key" : "HubSpot private app access token"}</label>
        <input className="input font-mono" id="token" name="token" type="password" autoComplete="off" placeholder="pat-na1-..." required />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Checking..." : connected ? "Save new key" : "Connect HubSpot"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">Connected. Run a sync below.</span>}
      </div>
    </form>
  );
}

export function SyncForm() {
  const { state, onSubmit, pending } = useFormAction<FormState>(syncHubSpotNow, {});
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <button className="btn btn-primary" disabled={pending}>{pending ? "Syncing... this can take a minute" : "Sync now"}</button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.ok && <span className="text-sm text-emerald-600">Sync finished.</span>}
    </form>
  );
}
