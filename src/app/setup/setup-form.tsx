"use client";

import { useEffect } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { setUpCompany, type SetupState } from "./actions";

export function SetupForm() {
  const { state, onSubmit, pending } = useFormAction<SetupState>(setUpCompany, {});
  useEffect(() => {
    if (state.ok) window.location.assign("/crm/accounts");
  }, [state]);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="companyName">Company name</label>
        <input className="input" id="companyName" name="companyName" defaultValue="Apple Moving" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input className="input" id="name" name="name" autoComplete="name" required />
        </div>
        <div>
          <label className="label" htmlFor="title">Your title (printed on quotes)</label>
          <input className="input" id="title" name="title" placeholder="Commercial Sales Manager" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="email">Your email (you sign in with this)</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="password">Password (10+ characters)</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Password again</label>
          <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending || state.ok}>
        {pending || state.ok ? "Setting up..." : "Set up Mothership"}
      </button>
    </form>
  );
}
