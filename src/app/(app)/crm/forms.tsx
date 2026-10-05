"use client";

import { ACCOUNT_SOURCES, ACTIVITY_TYPES, INDUSTRIES, STAGES } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;
type Option = { id: string; name: string };

function useForm(action: Action, resetOnSuccess = false) {
  return useFormAction<FormState>(action, {}, { resetOnSuccess });
}

function Status({ state, savedText = "Saved" }: { state: FormState; savedText?: string }) {
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-emerald-600">{savedText}</p>;
  return null;
}

function Input({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} {...rest} />
    </div>
  );
}

function Select({
  label,
  name,
  options,
  defaultValue,
  blank,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  blank?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select className="input" id={name} name={name} defaultValue={defaultValue ?? ""}>
        {blank !== undefined && <option value="">{blank}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export type AccountDefaults = {
  name?: string;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  source?: string;
  ownerId?: string | null;
};

export function AccountForm({
  action,
  users,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  users: Option[];
  defaults?: AccountDefaults;
  submitLabel: string;
}) {
  const { state, onSubmit, pending, ref } = useForm(action);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Company name" name="name" defaultValue={defaults.name} required placeholder="e.g. Hartwell & Lowe LLP" />
        <Select
          label="Company owner"
          name="ownerId"
          defaultValue={defaults.ownerId}
          options={users.map((u) => ({ value: u.id, label: u.name }))}
          blank="Me"
        />
        <Select
          label="Industry"
          name="industry"
          defaultValue={defaults.industry}
          options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
          blank="Not set"
        />
        <Select
          label="Source"
          name="source"
          defaultValue={defaults.source ?? "MANUAL"}
          options={ACCOUNT_SOURCES.map((s) => ({ value: s.id, label: s.label }))}
        />
        <Input label="Phone" name="phone" defaultValue={defaults.phone ?? ""} />
        <Input label="Website" name="website" defaultValue={defaults.website ?? ""} />
      </div>
      <Input label="Main address" name="address" defaultValue={defaults.address ?? ""} />
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function ContactForm({ action }: { action: Action }) {
  const { state, onSubmit, pending, ref } = useForm(action, true);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Name" name="name" required />
        <Input label="Title" name="title" placeholder="Facilities manager" />
        <Input label="Email" name="email" type="email" />
        <Input label="Phone" name="phone" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPrimary" /> Primary contact
      </label>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Adding..." : "Add contact"}</button>
        <Status state={state} savedText="Contact added" />
      </div>
    </form>
  );
}

export type ProjectDefaults = {
  accountId?: string;
  name?: string;
  stage?: string;
  originAddress?: string | null;
  destinationAddress?: string | null;
  moveDate?: string;
  estimatedValue?: number | null;
  managerId?: string | null;
  notes?: string | null;
};

export function ProjectForm({
  action,
  accounts,
  users,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  accounts: Option[];
  users: Option[];
  defaults?: ProjectDefaults;
  submitLabel: string;
}) {
  const { state, onSubmit, pending, ref } = useForm(action);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Project name" name="name" defaultValue={defaults.name} required placeholder="e.g. HQ relocation, floors 4-6" />
        <Select
          label="Company"
          name="accountId"
          defaultValue={defaults.accountId}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          blank="Choose a company"
        />
        <Select
          label="Stage"
          name="stage"
          defaultValue={defaults.stage ?? "LEAD"}
          options={STAGES.map((s) => ({ value: s.id, label: s.label }))}
        />
        <Select
          label="Project manager"
          name="managerId"
          defaultValue={defaults.managerId}
          options={users.map((u) => ({ value: u.id, label: u.name }))}
          blank="Unassigned"
        />
        <Input label="Move date" name="moveDate" type="date" defaultValue={defaults.moveDate ?? ""} />
        <Input
          label="Estimated value ($)"
          name="estimatedValue"
          inputMode="decimal"
          defaultValue={defaults.estimatedValue ?? ""}
          placeholder="25000"
        />
        <Input label="Moving from" name="originAddress" defaultValue={defaults.originAddress ?? ""} />
        <Input label="Moving to" name="destinationAddress" defaultValue={defaults.destinationAddress ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="notes">Notes</label>
        <textarea className="input min-h-20" id="notes" name="notes" defaultValue={defaults.notes ?? ""} />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function ActivityForm({ action }: { action: Action }) {
  const { state, onSubmit, pending, ref } = useForm(action, true);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-2">
      <textarea className="input min-h-16" name="body" placeholder="Log a call, email, meeting or note..." required />
      <div className="flex items-center gap-2">
        <select className="input w-auto" name="type" defaultValue="NOTE">
          {ACTIVITY_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving..." : "Log activity"}</button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}

export function ConfirmButton({
  action,
  label,
  confirmText,
  className = "btn btn-danger",
}: {
  action: () => Promise<void>;
  label: string;
  confirmText: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <button className={className}>{label}</button>
    </form>
  );
}
