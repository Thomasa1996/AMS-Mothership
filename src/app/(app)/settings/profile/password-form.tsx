"use client";

import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/lib/validation";
import { changeMyPassword } from "../actions";

export function PasswordForm() {
  const { state, onSubmit, pending, ref } = useFormAction<FormState>(changeMyPassword, {}, { resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="current">Current password</label>
          <input className="input" id="current" name="current" type="password" autoComplete="current-password" required />
        </div>
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <div>
          <label className="label" htmlFor="confirm">New password again</label>
          <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : "Change password"}</button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-emerald-600">Password changed. Use it next time you sign in.</p>}
      </div>
    </form>
  );
}
