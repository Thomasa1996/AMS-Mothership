"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addFromApollo } from "../../actions";
import { AddToCrm } from "../../add-button";
import { removeFromList, renameList } from "../../list-actions";

type Item = {
  id: string;
  apolloId: string;
  name: string;
  title: string | null;
  companyName: string | null;
  email: string | null;
  inCrm: { id: string; name: string; canOpen: boolean } | null;
};

export function RenameList({ listId, name }: { listId: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, start] = useTransition();
  if (!editing) {
    return (
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {name}
        <button className="text-sm font-normal text-slate-500 hover:text-slate-800" onClick={() => setEditing(true)}>Rename</button>
      </h2>
    );
  }
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await renameList(listId, value);
          setEditing(false);
        });
      }}
    >
      <input className="input py-1.5" value={value} onChange={(e) => setValue(e.target.value)} autoFocus maxLength={120} />
      <button className="btn btn-primary py-1.5" disabled={pending || !value.trim()}>Save</button>
      <button type="button" className="text-sm text-slate-500" onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}

export function ListView({ items, canOpenAll }: { items: Item[]; canOpenAll: boolean }) {
  const router = useRouter();
  const notAdded = items.filter((i) => !i.inCrm);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; errors: string[] } | null>(null);
  const [, start] = useTransition();

  // Adds people one at a time from the browser, so a long list never hits the server's time limit.
  const addAll = async () => {
    setConfirming(false);
    const queue = notAdded.map((i) => i.apolloId);
    const errors: string[] = [];
    setProgress({ done: 0, total: queue.length, errors });
    for (let n = 0; n < queue.length; n++) {
      const res = await addFromApollo(queue[n]!);
      if (res.error) {
        errors.push(res.error);
        // Out of credits, bad key and the like won't fix themselves on the next person.
        if (!/couldn't find/i.test(res.error)) {
          setProgress({ done: n, total: queue.length, errors: [...errors] });
          break;
        }
      }
      setProgress({ done: n + 1, total: queue.length, errors: [...errors] });
    }
    start(() => router.refresh());
  };
  const running = progress && progress.done < progress.total && progress.errors.length === 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm">
        {notAdded.length === 0 ? (
          <span className="text-slate-500">Everyone on this list is in the CRM.</span>
        ) : confirming ? (
          <>
            <span>Add {notAdded.length} {notAdded.length === 1 ? "person" : "people"} to the CRM? This uses up to {notAdded.length} Apollo credits.</span>
            <button className="btn btn-primary py-1.5" onClick={addAll}>Add them</button>
            <button className="text-slate-500" onClick={() => setConfirming(false)}>Cancel</button>
          </>
        ) : (
          <button className="btn py-1.5" disabled={!!running} onClick={() => setConfirming(true)}>
            Add all {notAdded.length} to CRM
          </button>
        )}
        {progress && (
          <span className={progress.errors.length ? "text-red-600" : "text-slate-600"}>
            {running ? `Adding ${progress.done + 1} of ${progress.total}...` : `Added ${progress.done - progress.errors.length} of ${progress.total}.`}
            {progress.errors.length > 0 && ` Stopped: ${progress.errors[progress.errors.length - 1]}`}
          </span>
        )}
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Title</th>
            <th>Company</th>
            <th>Email</th>
            <th className="text-right">CRM</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td className="whitespace-nowrap font-medium">{i.name}</td>
              <td>{i.title ?? <span className="text-slate-400">None listed</span>}</td>
              <td>{i.companyName ?? <span className="text-slate-400">None listed</span>}</td>
              <td>{i.email ?? <span className="text-slate-400">{i.inCrm ? "None found" : "Shows once added"}</span>}</td>
              <td className="text-right">
                {i.inCrm ? (
                  i.inCrm.canOpen ? (
                    <Link href={`/crm/accounts/${i.inCrm.id}`} className="link whitespace-nowrap text-sm">In CRM: {i.inCrm.name}</Link>
                  ) : (
                    <span className="whitespace-nowrap text-sm text-slate-500">In CRM: {i.inCrm.name}</span>
                  )
                ) : (
                  <AddToCrm apolloId={i.apolloId} canOpen={canOpenAll} />
                )}
              </td>
              <td className="text-right">
                <button className="text-sm text-slate-400 hover:text-red-600" onClick={() => start(() => removeFromList(i.id))} title="Remove from this list">
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
