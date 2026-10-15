"use client";

import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";
import { connectMail, saveMailPeople, syncMailNow } from "./actions";

export function MailConnectForm({ tenantId, clientId, connected, canReuse }: { tenantId: string; clientId: string; connected: boolean; canReuse: boolean }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(connectMail, {});
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
        <label className="label" htmlFor="secret">
          {connected ? "Client secret (leave blank to keep the saved one)" : canReuse ? "Client secret (leave blank to use the Power BI app's)" : "Client secret value"}
        </label>
        <input className="input font-mono" id="secret" name="secret" type="password" autoComplete="off" required={!connected && !canReuse} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Checking..." : connected ? "Save" : "Connect Microsoft 365"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">Connected.</span>}
      </div>
    </form>
  );
}

export function MailPeopleForm({ people, since }: { people: { id: string; name: string; email: string; on: boolean }[]; since: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveMailPeople, {});
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {people.map((p) => (
          <label key={p.id} className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="people" value={p.id} defaultChecked={p.on} className="mt-1" />
            <span>
              {p.name} <span className="block text-xs text-slate-500">{p.email}</span>
            </span>
          </label>
        ))}
      </div>
      <div>
        <label className="label" htmlFor="since">Pull proposals sent since</label>
        <input className="input w-auto" id="since" name="since" type="date" defaultValue={since} required />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : "Save"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">Saved. Click Pull now to start.</span>}
      </div>
    </form>
  );
}

export function MailSyncNowButton() {
  const { state, onSubmit, pending } = useFormAction<FormState>(syncMailNow, {});
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <button className="btn" disabled={pending}>{pending ? "Pulling (up to a minute)..." : "Pull now"}</button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.ok && <span className="text-sm text-emerald-600">Done.</span>}
    </form>
  );
}
