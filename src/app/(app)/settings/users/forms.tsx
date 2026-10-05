"use client";

import { useFormAction } from "@/lib/use-form-action";
import { ROLES } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import { useState, useTransition } from "react";
import { createUser, removeUser, setPassword } from "./actions";

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

export function RemoveUserButton({ user, teammates, defaultHandTo }: { user: { id: string; name: string; accounts: number }; teammates: { id: string; name: string }[]; defaultHandTo: string }) {
  const [open, setOpen] = useState(false);
  const [handTo, setHandTo] = useState(defaultHandTo);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) {
    return <button className="text-sm text-slate-400 hover:text-red-600" onClick={() => setOpen(true)}>Remove</button>;
  }
  return (
    <div className="space-y-2 rounded-md border border-red-200 p-3 text-sm">
      <p>
        Remove <b>{user.name}</b>? They won&apos;t be able to sign in. Their notes and quotes stay.
      </p>
      <label className="flex flex-wrap items-center gap-2">
        {user.accounts ? `Hand their ${user.accounts} accounts, projects and lists to` : "Hand their projects and lists to"}
        <select className="input w-auto py-1" value={handTo} onChange={(e) => setHandTo(e.target.value)}>
          {teammates.filter((t) => t.id !== user.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <button
          className="btn btn-danger py-1"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await removeUser(user.id, handTo);
              if (res.error) setError(res.error);
            })
          }
        >
          {pending ? "Removing..." : "Remove from team"}
        </button>
        <button className="text-slate-500" onClick={() => setOpen(false)}>Cancel</button>
        {error && <span className="text-red-600">{error}</span>}
      </div>
    </div>
  );
}

export function SetPasswordButton({ user }: { user: { id: string; name: string } }) {
  const [open, setOpen] = useState(false);
  const [password, setPw] = useState("");
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <span className="flex items-center justify-end gap-2">
        {state.ok && <span className="whitespace-nowrap text-xs text-emerald-600">Password changed</span>}
        <button className="whitespace-nowrap text-sm text-slate-400 hover:text-slate-800" onClick={() => { setOpen(true); setState({}); }}>Set password</button>
      </span>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-3 text-left text-sm">
      <label className="block">
        New password for <b>{user.name}</b>
        <input className="input mt-1 py-1" type="text" autoComplete="off" minLength={8} value={password} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
      </label>
      <div className="flex items-center gap-3">
        <button
          className="btn btn-primary py-1"
          disabled={pending || password.length < 8}
          onClick={() =>
            start(async () => {
              const res = await setPassword(user.id, password);
              setState(res);
              if (res.ok) { setOpen(false); setPw(""); }
            })
          }
        >
          {pending ? "Saving..." : "Save password"}
        </button>
        <button className="text-slate-500" onClick={() => { setOpen(false); setPw(""); }}>Cancel</button>
        {state.error && <span className="text-red-600">{state.error}</span>}
      </div>
    </div>
  );
}
