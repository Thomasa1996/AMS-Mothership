"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { searchAccounts, setQuoteDocAccount } from "./doc-actions";

type Account = { id: string; name: string; inHubSpot: boolean };

// The client a quote file is for, under its name, and whether it has reached that company in HubSpot.
// Its rep or an admin can pick a different account.
export function DocAccount({ id, account, sent, error, hubspot, canEdit }: { id: string; account: Account | null; sent: boolean; error: string | null; hubspot: boolean; canEdit: boolean }) {
  const [current, setCurrent] = useState(account);
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Account[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    let stale = false;
    const t = setTimeout(async () => {
      const found = await searchAccounts(q).catch(() => []);
      if (!stale) setResults(found);
    }, 200);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, editing]);

  function choose(next: Account | null) {
    start(async () => {
      const res = await setQuoteDocAccount(id, next?.id ?? "").catch(() => ({ error: "That didn't save. Try again." }) as { error: string });
      if (res.error) return setProblem(res.error);
      setProblem(null);
      setCurrent(next);
      setEditing(false);
      setQ("");
    });
  }

  if (editing) {
    return (
      <div className="relative mt-1 max-w-xs text-sm">
        <input
          ref={input}
          className="input py-1 text-sm"
          placeholder="Type an account name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          disabled={pending}
        />
        <div className="absolute z-10 mt-1 w-full rounded border border-slate-200 bg-white shadow-lg">
          {results.map((r) => (
            <button key={r.id} type="button" className="block w-full px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => choose(r)}>
              {r.name}
              {r.inHubSpot && <span className="ml-2 text-xs text-slate-400">HubSpot</span>}
            </button>
          ))}
          {q.trim().length >= 2 && !results.length && <p className="px-3 py-1.5 text-slate-500">No account by that name</p>}
          <div className="flex justify-between border-t border-slate-100 px-3 py-1.5 text-xs">
            {current ? (
              <button type="button" className="text-slate-500 hover:text-red-600" onClick={() => choose(null)}>No account</button>
            ) : <span />}
            <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  const unchanged = current?.id === account?.id;
  let status: React.ReactNode = null;
  if (hubspot && current) {
    if (!current.inHubSpot) status = <span className="text-slate-400">Not a HubSpot company</span>;
    else if (unchanged && sent) status = <span className="text-emerald-600">In HubSpot</span>;
    else if (unchanged && error) status = <span className="text-red-600" title={error}>Not sent to HubSpot</span>;
    else status = <span className="text-slate-400">Sending to HubSpot</span>;
  }

  return (
    <span className="mt-0.5 block text-xs text-slate-500">
      {current ? (
        <Link href={`/crm/accounts/${current.id}`} className="hover:underline">{current.name}</Link>
      ) : (
        <span className="text-amber-700">No account</span>
      )}
      {status && <> · {status}</>}
      {canEdit && (
        <button type="button" className="ml-2 text-slate-400 hover:text-slate-800" onClick={() => setEditing(true)}>
          {current ? "Change" : "Pick account"}
        </button>
      )}
      {problem && <span className="ml-2 text-red-600">{problem}</span>}
    </span>
  );
}
