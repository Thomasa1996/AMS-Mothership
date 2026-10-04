"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addFromApollo, type AddState } from "./actions";

export function AddToCrm({ apolloId, canOpen }: { apolloId: string; canOpen: boolean }) {
  const [state, setState] = useState<AddState>({});
  const [pending, start] = useTransition();
  if (state.ok && state.accountId) {
    return canOpen || state.mine ? (
      <Link href={`/crm/accounts/${state.accountId}`} className="link whitespace-nowrap text-sm">Added to {state.accountName}</Link>
    ) : (
      <span className="whitespace-nowrap text-sm text-emerald-600">Added to {state.accountName}</span>
    );
  }
  return (
    <div className="text-right">
      <button
        className="btn whitespace-nowrap text-sm"
        disabled={pending}
        title="Looks up their full name and work email in Apollo, which uses 1 credit"
        onClick={() => start(async () => setState(await addFromApollo(apolloId)))}
      >
        {pending ? "Adding..." : "Add to CRM"}
      </button>
      {state.error && <div className="mt-1 max-w-xs text-xs text-red-600">{state.error}</div>}
    </div>
  );
}
