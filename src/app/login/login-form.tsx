"use client";

import { useEffect } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const { state, onSubmit, pending } = useFormAction<LoginState>(login, {});
  useEffect(() => {
    if (state.ok) window.location.assign("/crm/accounts");
  }, [state]);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending || state.ok}>
        {pending || state.ok ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
