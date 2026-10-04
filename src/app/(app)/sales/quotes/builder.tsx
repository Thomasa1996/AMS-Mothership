"use client";

import { useMemo, useState, useTransition } from "react";
import { formatCents, lineAmountCents, lineDetail, parseDollarsToCents } from "@/lib/quote-math";
import type { SaveState } from "./actions";

export type RateOption = { id: string; category: string; name: string; unit: string; rateCents: number; notes: string | null };

// A market's prices by rate item id; items missing here use the standard rate.
export type MarketOption = { id: string; name: string; rates: Record<string, number> };

export type ProjectOption = {
  id: string;
  name: string;
  accountName: string;
  contact: { name: string; title: string | null; phone: string | null; email: string | null } | null;
};

export type DraftLine = {
  key: string;
  category: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  note: string;
};

export type QuoteDraft = {
  projectId: string;
  branchId: string;
  title: string;
  quoteDate: string;
  serviceDescription: string;
  recipientName: string;
  recipientTitle: string;
  recipientCompany: string;
  recipientPhone: string;
  recipientEmail: string;
  clientLabel: string;
  clientLogo: string;
  scopeTitle: string;
  timeline: string;
  scope: string;
  investmentHeading: string;
  totalLabel: string;
  intro: string;
  valuation: string;
  optionalValuation: string;
  companyDuties: string;
  clientDuties: string;
  lines: DraftLine[];
};

const MAX_LOGO_BYTES = 500 * 1024;

let keySeq = 0;
export const newKey = () => `line-${Date.now()}-${keySeq++}`;

function parseQuantity(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function Text({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({ label, value, onChange, rows = 4, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea className="input" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function QuoteBuilder({
  initial,
  projects,
  rates,
  markets,
  save,
  submitLabel,
}: {
  initial: QuoteDraft;
  projects: ProjectOption[];
  rates: RateOption[];
  markets: MarketOption[];
  save: (input: unknown) => Promise<SaveState>;
  submitLabel: string;
}) {
  const [draft, setDraft] = useState<QuoteDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [rateFilter, setRateFilter] = useState("");

  const set = <K extends keyof QuoteDraft>(key: K) => (value: QuoteDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const setLine = (key: string, patch: Partial<DraftLine>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  const moveLine = (index: number, delta: number) =>
    setDraft((d) => {
      const lines = [...d.lines];
      const target = index + delta;
      if (target < 0 || target >= lines.length) return d;
      [lines[index], lines[target]] = [lines[target]!, lines[index]!];
      return { ...d, lines };
    });

  const market = markets.find((m) => m.id === draft.branchId);
  const priceOf = (rate: RateOption) => market?.rates[rate.id] ?? rate.rateCents;

  const addLine = (rate?: RateOption) =>
    setDraft((d) => ({
      ...d,
      lines: [
        ...d.lines,
        rate
          ? {
              key: newKey(),
              category: rate.category,
              description: rate.name,
              quantity: "1",
              unit: rate.unit,
              rate: (priceOf(rate) / 100).toFixed(2),
              note: "",
            }
          : { key: newKey(), category: "", description: "", quantity: "1", unit: "flat", rate: "", note: "" },
      ],
    }));

  // Picking a project fills the client details that are still blank.
  const chooseProject = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId);
    setDraft((d) => ({
      ...d,
      projectId,
      title: d.title || (p ? p.name : ""),
      recipientName: d.recipientName || p?.contact?.name || "",
      recipientTitle: d.recipientTitle || p?.contact?.title || "",
      recipientPhone: d.recipientPhone || p?.contact?.phone || "",
      recipientEmail: d.recipientEmail || p?.contact?.email || "",
      recipientCompany: d.recipientCompany || p?.accountName || "",
      clientLabel: d.clientLabel || p?.accountName || "",
    }));
  };

  const onLogo = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setError("The client logo must be under 500 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("clientLogo")(String(reader.result));
    reader.readAsDataURL(file);
  };

  const computed = draft.lines.map((l) => {
    const quantity = parseQuantity(l.quantity);
    const rateCents = parseDollarsToCents(l.rate);
    const amount = quantity != null && rateCents != null ? lineAmountCents(quantity, rateCents) : null;
    return { quantity, rateCents, amount };
  });
  const total = computed.reduce((s, c) => s + (c.amount ?? 0), 0);

  const rateGroups = useMemo(() => {
    const q = rateFilter.toLowerCase();
    const groups = new Map<string, RateOption[]>();
    for (const r of rates) {
      if (q && !`${r.category} ${r.name}`.toLowerCase().includes(q)) continue;
      groups.set(r.category, [...(groups.get(r.category) ?? []), r]);
    }
    return [...groups.entries()];
  }, [rates, rateFilter]);

  const submit = () => {
    setError(null);
    for (const [i, c] of computed.entries()) {
      if (c.quantity == null) return setError(`Line ${i + 1}: enter a quantity`);
      if (c.rateCents == null) return setError(`Line ${i + 1}: enter a dollar amount for the rate`);
    }
    const { lines, ...rest } = draft;
    const input = {
      ...rest,
      branchId: rest.branchId || null,
      clientLogo: rest.clientLogo || null,
      lines: lines.map((l, i) => ({
        category: l.category,
        description: l.description,
        quantity: computed[i]!.quantity!,
        unit: l.unit,
        rateCents: computed[i]!.rateCents!,
        note: l.note,
      })),
    };
    startTransition(async () => {
      const result = await save(input);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="space-y-6 pb-24">
      <Section title="Project and client">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Project</label>
            <select className="input" value={draft.projectId} onChange={(e) => chooseProject(e.target.value)}>
              <option value="">Choose a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.accountName}: {p.name}
                </option>
              ))}
            </select>
          </div>
          <Text label="Quote title" value={draft.title} onChange={set("title")} placeholder="Relocation to MO" />
          {markets.length > 0 && (
            <div>
              <label className="label">Market (prices from the rate card)</label>
              <select className="input" value={draft.branchId} onChange={(e) => set("branchId")(e.target.value)}>
                <option value="">Standard rates</option>
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">Lines already added keep their prices.</p>
            </div>
          )}
          <Text label="Quote date" type="date" value={draft.quoteDate} onChange={set("quoteDate")} />
          <Text
            label="Service (finishes the intro sentence)"
            value={draft.serviceDescription}
            onChange={set("serviceDescription")}
            placeholder="Decommission services in Oak Ridge Tennessee"
          />
        </div>
        <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-700">Prepared for</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Name" value={draft.recipientName} onChange={set("recipientName")} />
          <Text label="Title" value={draft.recipientTitle} onChange={set("recipientTitle")} placeholder="Relocation Team Lead" />
          <Text label="Company line" value={draft.recipientCompany} onChange={set("recipientCompany")} placeholder="JLL for the Leidos Account" />
          <Text label="Client name in responsibilities" value={draft.clientLabel} onChange={set("clientLabel")} placeholder="JLL" />
          <Text label="Phone" value={draft.recipientPhone} onChange={set("recipientPhone")} />
          <Text label="Email" value={draft.recipientEmail} onChange={set("recipientEmail")} />
          <div className="sm:col-span-2">
            <label className="label">Client logo for the cover page (optional)</label>
            <div className="flex items-center gap-3">
              {draft.clientLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.clientLogo} alt="Client logo" className="h-10 max-w-40 rounded border border-slate-200 bg-white object-contain p-1" />
              )}
              <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="text-sm" onChange={(e) => onLogo(e.target.files?.[0])} />
              {draft.clientLogo && (
                <button type="button" className="text-sm text-slate-500 hover:text-red-600" onClick={() => set("clientLogo")("")}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Scope">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Section title" value={draft.scopeTitle} onChange={set("scopeTitle")} />
          <Text label="Proposed timeline" value={draft.timeline} onChange={set("timeline")} placeholder="January 13-18, 2026" />
        </div>
        <div className="mt-4">
          <Area
            label="Scope details"
            rows={10}
            value={draft.scope}
            onChange={set("scope")}
            hint="Start a line with • or - for a bullet. Blank lines separate paragraphs."
          />
        </div>
      </Section>

      <Section title="Financial investment" aside={<span className="text-lg font-semibold">{formatCents(total)}</span>}>
        <Text label="Heading" value={draft.investmentHeading} onChange={set("investmentHeading")} />
        <div className="mt-4 overflow-x-auto">
          <table className="table min-w-[860px]">
            <thead>
              <tr>
                <th className="w-8" />
                <th>Description</th>
                <th className="w-24">Qty</th>
                <th className="w-32">Unit</th>
                <th className="w-28">Rate ($)</th>
                <th className="w-28 text-right">Amount</th>
                <th>Note in brackets</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((l, i) => {
                const c = computed[i]!;
                const preview =
                  c.quantity != null && c.rateCents != null
                    ? lineDetail({ quantity: c.quantity, unit: l.unit, rateCents: c.rateCents, note: l.note })
                    : null;
                return (
                  <tr key={l.key} className="align-top">
                    <td className="px-1">
                      <div className="flex flex-col text-slate-400">
                        <button type="button" aria-label="Move up" className="hover:text-slate-700" onClick={() => moveLine(i, -1)}>▲</button>
                        <button type="button" aria-label="Move down" className="hover:text-slate-700" onClick={() => moveLine(i, 1)}>▼</button>
                      </div>
                    </td>
                    <td>
                      <input className="input" value={l.description} placeholder="Relocation to MO" onChange={(e) => setLine(l.key, { description: e.target.value })} />
                      {l.category && <div className="mt-1 text-xs text-slate-400">{l.category}</div>}
                    </td>
                    <td>
                      <input className={`input ${c.quantity == null ? "border-red-300" : ""}`} inputMode="decimal" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} />
                    </td>
                    <td>
                      <input className="input" value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value })} />
                    </td>
                    <td>
                      <input className={`input ${c.rateCents == null ? "border-red-300" : ""}`} inputMode="decimal" value={l.rate} placeholder="0.00" onChange={(e) => setLine(l.key, { rate: e.target.value })} />
                    </td>
                    <td className="whitespace-nowrap pt-4 text-right font-medium">{c.amount != null ? formatCents(c.amount) : ""}</td>
                    <td>
                      <input className="input" value={l.note} placeholder={preview ?? "includes 6 months of storage"} onChange={(e) => setLine(l.key, { note: e.target.value })} />
                    </td>
                    <td className="px-1 pt-4">
                      <button
                        type="button"
                        aria-label="Remove line"
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => setDraft((d) => ({ ...d, lines: d.lines.filter((x) => x.key !== l.key) }))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <button type="button" className="btn" onClick={() => addLine()}>Add custom line</button>
          <details className="relative">
            <summary className="btn cursor-pointer list-none">Add from rate card</summary>
            <div className="absolute z-10 mt-1 max-h-96 w-[28rem] max-w-[90vw] overflow-y-auto rounded-lg border border-slate-200 bg-surface p-2 shadow-lg">
              <input className="input mb-2" placeholder="Search the rate card" value={rateFilter} onChange={(e) => setRateFilter(e.target.value)} />
              {rateGroups.length === 0 && <p className="p-2 text-sm text-slate-500">No matching rates.</p>}
              {rateGroups.map(([category, items]) => (
                <div key={category} className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</div>
                  {items.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="flex w-full justify-between gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-brand-50"
                      onClick={() => addLine(r)}
                    >
                      <span>{r.name}</span>
                      <span className="whitespace-nowrap text-slate-500">
                        {formatCents(priceOf(r))} / {r.unit}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </details>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Text label="Total label" value={draft.totalLabel} onChange={set("totalLabel")} />
          <div className="sm:pt-6 sm:text-right">
            <span className="text-sm text-slate-500">{draft.totalLabel}: </span>
            <span className="text-xl font-semibold">{formatCents(total)}</span>
          </div>
        </div>
      </Section>

      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">Introduction, valuation and terms</summary>
        <p className="mt-2 text-sm text-slate-500">
          Starts from your quote template. Edits here change this quote only. Use {"{company}"} and {"{service}"} where the names should go.
        </p>
        <div className="mt-4 space-y-4">
          <Area label="Introduction" value={draft.intro} onChange={set("intro")} rows={3} />
          <Area label="Valuation" value={draft.valuation} onChange={set("valuation")} rows={5} />
          <Area label="Optional full replacement valuation" value={draft.optionalValuation} onChange={set("optionalValuation")} rows={4} />
          <Area label="Our responsibilities (one per line)" value={draft.companyDuties} onChange={set("companyDuties")} rows={8} />
          <Area label="Client responsibilities (one per line)" value={draft.clientDuties} onChange={set("clientDuties")} rows={8} />
        </div>
      </details>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-3">
          {error && <p className="mr-auto text-sm text-red-600">{error}</p>}
          <span className="text-sm text-slate-500">
            {draft.lines.length} {draft.lines.length === 1 ? "line" : "lines"} · <strong className="text-slate-900">{formatCents(total)}</strong>
          </span>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>
            {pending ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
