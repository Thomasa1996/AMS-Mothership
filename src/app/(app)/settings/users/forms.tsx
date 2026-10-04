"use client";

import { useFormAction } from "@/lib/use-form-action";
import { ROLES } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import { createUser } from "./actions";

export function NewUserForm() {
  const { state, onSubmit, pending, ref } = useFormAction<FormState>(createUser, {}, { resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input className="input" id="name" name="name" required />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="role">Role</label>
          <select className="input" id="role" name="role" defaultValue="SALES">
            {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="password">Temporary password</label>
          <input className="input" id="password" name="password" type="text" minLength={8} required />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Adding..." : "Add teammate"}</button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-emerald-600">Teammate added. Share their email and temporary password with them.</p>}
      </div>
    </form>
  );
}
