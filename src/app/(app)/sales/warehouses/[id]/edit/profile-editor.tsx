"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BranchContact, BranchSection, BranchWarehouse } from "@/lib/branches";
import type { FormState } from "@/lib/validation";

type Profile = {
  name: string;
  profileDate: string;
  approval: string;
  warehouses: BranchWarehouse[];
  contacts: BranchContact[];
  profile: BranchSection[];
};

const s = (v: string | null | undefined) => v ?? "";

function Remove({ onClick, label = "Remove" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="text-sm text-slate-500 hover:text-red-600">
      {label}
    </button>
  );
}

export function ProfileEditor({ branchId, initial, save }: { branchId: string; initial: Profile; save: (input: unknown) => Promise<FormState> }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  const columns = Math.max(1, p.warehouses.length);
  const update = (patch: Partial<Profile>) => setP((cur) => ({ ...cur, ...patch }));
  const setContact = (i: number, patch: Partial<BranchContact>) => update({ contacts: p.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const setWarehouse = (i: number, patch: Partial<BranchWarehouse>) => update({ warehouses: p.warehouses.map((w, j) => (j === i ? { ...w, ...patch } : w)) });
  const setSection = (i: number, next: BranchSection) => update({ profile: p.profile.map((x, j) => (j === i ? next : x)) });

  const submit = () =>
    start(async () => {
      const res = await save({
        ...p,
        profile: p.profile.map((sec) => ({ ...sec, facts: sec.facts.map((f) => ({ ...f, values: Array.from({ length: columns }, (_, c) => f.values[c] ?? "") })) })),
      });
      setState(res);
      if (res.ok) router.push(`/sales/warehouses/${branchId}`);
    });

  return (
    <div className="space-y-6 pb-20">
      <section className="card grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="name">Branch name</label>
          <input className="input" id="name" value={p.name} onChange={(e) => update({ name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="profileDate">Profile date</label>
          <input className="input" id="profileDate" value={p.profileDate} onChange={(e) => update({ profileDate: e.target.value })} placeholder="9/13/24" />
        </div>
        <div>
          <label className="label" htmlFor="approval">Approval</label>
          <input className="input" id="approval" value={p.approval} onChange={(e) => update({ approval: e.target.value })} />
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Warehouses</h2>
        {p.warehouses.map((w, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="label">Warehouse {i + 1} address</label>
              <input className="input" value={s(w.address)} onChange={(e) => setWarehouse(i, { address: e.target.value })} />
            </div>
            <div>
              <label className="label">City, state, ZIP</label>
              <input className="input" value={s(w.cityStateZip)} onChange={(e) => setWarehouse(i, { cityStateZip: e.target.value })} />
            </div>
            <div className="pb-2">
              <Remove onClick={() => update({ warehouses: p.warehouses.filter((_, j) => j !== i), profile: p.profile.map((sec) => ({ ...sec, facts: sec.facts.map((f) => ({ ...f, values: f.values.filter((_, c) => c !== i) })) })) })} />
            </div>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => update({ warehouses: [...p.warehouses, { address: "", cityStateZip: "" }] })}>Add warehouse</button>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Contacts</h2>
        {p.contacts.map((c, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_1.3fr_auto]">
            <div>
              <label className="label">Title</label>
              <input className="input" value={c.title} onChange={(e) => setContact(i, { title: e.target.value })} placeholder="General Manager" />
            </div>
            <div>
              <label className="label">Name</label>
              <input className="input" value={s(c.name)} onChange={(e) => setContact(i, { name: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={s(c.phone)} onChange={(e) => setContact(i, { phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={s(c.email)} onChange={(e) => setContact(i, { email: e.target.value })} />
            </div>
            <div className="pb-2"><Remove onClick={() => update({ contacts: p.contacts.filter((_, j) => j !== i) })} /></div>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => update({ contacts: [...p.contacts, { title: "", name: "", phone: "", email: "" }] })}>Add contact</button>
      </section>

      {p.profile.map((sec, si) => (
        <section key={si} className="card space-y-3 p-5">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="label">Section</label>
              <input className="input font-semibold" value={sec.title} onChange={(e) => setSection(si, { ...sec, title: e.target.value })} />
            </div>
            <div className="pb-2"><Remove label="Remove section" onClick={() => update({ profile: p.profile.filter((_, j) => j !== si) })} /></div>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Detail</th>
                  {Array.from({ length: columns }, (_, c) => <th key={c}>{columns > 1 ? `Warehouse ${c + 1}` : "Value"}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {sec.facts.map((f, fi) => {
                  const setFact = (next: typeof f) => setSection(si, { ...sec, facts: sec.facts.map((x, j) => (j === fi ? next : x)) });
                  return (
                    <tr key={fi}>
                      <td className="min-w-48"><input className="input" value={f.label} onChange={(e) => setFact({ ...f, label: e.target.value })} /></td>
                      {Array.from({ length: columns }, (_, c) => (
                        <td key={c} className="min-w-36">
                          <input
                            className="input"
                            value={f.values[c] ?? ""}
                            onChange={(e) => setFact({ ...f, values: Array.from({ length: columns }, (_, k) => (k === c ? e.target.value : f.values[k] ?? "")) })}
                          />
                        </td>
                      ))}
                      <td><Remove onClick={() => setSection(si, { ...sec, facts: sec.facts.filter((_, j) => j !== fi) })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn" onClick={() => setSection(si, { ...sec, facts: [...sec.facts, { label: "", values: [] }] })}>Add detail</button>
        </section>
      ))}
      <button type="button" className="btn" onClick={() => update({ profile: [...p.profile, { title: "New section", facts: [] }] })}>Add section</button>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-3">
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
          <a href={`/sales/warehouses/${branchId}`} className="btn">Cancel</a>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>{pending ? "Saving..." : "Save profile"}</button>
        </div>
      </div>
    </div>
  );
}
