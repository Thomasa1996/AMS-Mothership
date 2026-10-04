"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AddToCrm } from "./add-button";
import { saveToList, type SaveListState } from "./list-actions";

export type ResultRow = {
  apolloId: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyName: string | null;
  inCrm: { id: string; name: string; canOpen: boolean } | null;
};

export function ResultsTable({ rows, lists, canOpenAll }: { rows: ResultRow[]; lists: { id: string; name: string }[]; canOpenAll: boolean }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState(lists[0]?.id ?? "new");
  const [newName, setNewName] = useState("");
  const [state, setState] = useState<SaveListState>({});
  const [pending, start] = useTransition();

  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.apolloId));
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () =>
    start(async () => {
      const people = rows
        .filter((r) => picked.has(r.apolloId))
        .map(({ apolloId, firstName, lastName, title, companyName }) => ({ apolloId, firstName, lastName, title, companyName }));
      const res = await saveToList(target === "new" ? { newName, people } : { listId: target, people });
      setState(res);
      if (res.ok) {
        setPicked(new Set());
        setNewName("");
        if (res.listId) setTarget(res.listId);
      }
    });

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm">
        <span className="font-medium">{picked.size ? `${picked.size} selected` : "Tick people to save them to a list"}</span>
        {picked.size > 0 && (
          <>
            <select className="input w-auto py-1.5" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="List">
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              <option value="new">New list...</option>
            </select>
            {target === "new" && (
              <input className="input w-56 py-1.5" placeholder="List name, e.g. DC facilities managers" value={newName} onChange={(e) => setNewName(e.target.value)} />
            )}
            <button className="btn btn-primary py-1.5" disabled={pending || (target === "new" && !newName.trim())} onClick={save}>
              {pending ? "Saving..." : "Save to list"}
            </button>
          </>
        )}
        {state.error && <span className="text-red-600">{state.error}</span>}
        {state.ok && state.listId && (
          <span className="text-emerald-600">
            Saved {state.added} to <Link href={`/sales/new-business/lists/${state.listId}`} className="link">{state.listName}</Link>
            {state.added === 0 ? " (they were already on it)" : ""}
          </span>
        )}
      </div>
      <table className="table">
        <thead>
          <tr>
            <th className="w-8">
              <input
                type="checkbox"
                aria-label="Select everyone on this page"
                checked={allPicked}
                onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.apolloId)))}
              />
            </th>
            <th>Name</th>
            <th>Title</th>
            <th>Company</th>
            <th className="text-right">CRM</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.apolloId}>
              <td>
                <input type="checkbox" aria-label={`Select ${r.firstName ?? "person"}`} checked={picked.has(r.apolloId)} onChange={() => toggle(r.apolloId)} />
              </td>
              <td className="whitespace-nowrap font-medium">{[r.firstName, r.lastName].filter(Boolean).join(" ") || "Name hidden"}</td>
              <td>{r.title ?? <span className="text-slate-400">None listed</span>}</td>
              <td>{r.companyName ?? <span className="text-slate-400">None listed</span>}</td>
              <td className="text-right">
                {r.inCrm ? (
                  r.inCrm.canOpen ? (
                    <Link href={`/crm/accounts/${r.inCrm.id}`} className="link whitespace-nowrap text-sm">In CRM: {r.inCrm.name}</Link>
                  ) : (
                    <span className="whitespace-nowrap text-sm text-slate-500">In CRM: {r.inCrm.name}</span>
                  )
                ) : (
                  <AddToCrm apolloId={r.apolloId} canOpen={canOpenAll} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
