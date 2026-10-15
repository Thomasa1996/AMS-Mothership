"use client";

import { useMemo, useState } from "react";
import { formatCents } from "@/lib/quote-math";
import { DEFAULT_TRUCK_BUFFER_PCT, crewHeadline, travelPlan, travelSentence } from "@/lib/quote-plan";
import type { RateOption } from "./builder";

import {
  dollars,
  k,
  planDraftTotals,
  type CrewDraft,
  type DayDraft,
  type MaterialDraft,
  type PlanDraft,
  type TravelDraft,
} from "./plan-draft";

const emptyDay = (): DayDraft => ({
  key: k("day"),
  title: "",
  date: "TBD",
  startTime: "TBD",
  origin: "",
  destination: "",
  scope: "",
  crew: [],
  hours: "8",
  trucks: "1",
  truckLabel: "Straight Truck w/liftgate",
  loads: "",
});

function Field({
  label,
  value,
  onChange,
  placeholder,
  className = "",
  inputMode,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputMode?: "decimal" | "numeric";
  type?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      <input className="input" type={type} inputMode={inputMode} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function RatePicker({ label, rates, onPick, price }: { label: string; rates: RateOption[]; onPick: (r: RateOption) => void; price: (r: RateOption) => number }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const m = new Map<string, RateOption[]>();
    for (const r of rates) {
      if (q && !`${r.category} ${r.name}`.toLowerCase().includes(q.toLowerCase())) continue;
      m.set(r.category, [...(m.get(r.category) ?? []), r]);
    }
    return [...m.entries()];
  }, [rates, q]);
  return (
    <details className="relative">
      <summary className="btn cursor-pointer list-none">{label}</summary>
      <div className="absolute z-10 mt-1 max-h-80 w-[26rem] max-w-[90vw] overflow-y-auto rounded-lg border border-slate-200 bg-surface p-2 shadow-lg">
        <input className="input mb-2" placeholder="Search the rate card" value={q} onChange={(e) => setQ(e.target.value)} />
        {groups.length === 0 && <p className="p-2 text-sm text-slate-500">No matching rates.</p>}
        {groups.map(([category, items]) => (
          <div key={category} className="mb-2">
            <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</div>
            {items.map((r) => (
              <button
                key={r.id}
                type="button"
                className="flex w-full justify-between gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-brand-50"
                onClick={(e) => {
                  onPick(r);
                  (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                }}
              >
                <span>{r.name}</span>
                <span className="whitespace-nowrap text-slate-500">
                  {formatCents(price(r))} / {r.unit}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}

const isCrewRate = (r: RateOption) => r.unit === "hour";
// Equipment the crew brings is listed as free rental by default, as on Apple Moving's quotes.
const isFreeByDefault = (r: RateOption) => /equipment rental/i.test(r.category);

export function PlanEditor({
  plan,
  onChange,
  rates,
  price,
}: {
  plan: PlanDraft;
  onChange: (next: PlanDraft) => void;
  rates: RateOption[];
  price: (r: RateOption) => number;
}) {
  const totals = planDraftTotals(plan);
  const crewRates = rates.filter(isCrewRate);
  const materialRates = rates.filter((r) => !isCrewRate(r));

  const setDay = (key: string, patch: Partial<DayDraft>) =>
    onChange({ ...plan, days: plan.days.map((d) => (d.key === key ? { ...d, ...patch } : d)) });
  const setCrew = (day: DayDraft, key: string, patch: Partial<CrewDraft>) =>
    setDay(day.key, { crew: day.crew.map((c) => (c.key === key ? { ...c, ...patch } : c)) });
  const setMat = (key: string, patch: Partial<MaterialDraft>) =>
    onChange({ ...plan, materials: plan.materials.map((m) => (m.key === key ? { ...m, ...patch } : m)) });
  const travel = plan.travel;
  const setTravel = (patch: Partial<TravelDraft>) =>
    onChange({ ...plan, travel: { ...(travel ?? { carMinutes: "", bufferPct: String(DEFAULT_TRUCK_BUFFER_PCT), loadMinutes: "", arriveBy: "" }), ...patch } });

  const copyDay = (d: DayDraft) => {
    const i = plan.days.findIndex((x) => x.key === d.key);
    const copy = { ...d, key: k("day"), crew: d.crew.map((c) => ({ ...c, key: k("crew") })) };
    onChange({ ...plan, days: [...plan.days.slice(0, i + 1), copy, ...plan.days.slice(i + 1)] });
  };

  const travelNumbers = travel
    ? {
        carMinutes: Number(travel.carMinutes) || 0,
        bufferPct: travel.bufferPct === "" ? DEFAULT_TRUCK_BUFFER_PCT : Number(travel.bufferPct) || 0,
        loadMinutes: Number(travel.loadMinutes) || 0,
        arriveBy: /^\d{2}:\d{2}$/.test(travel.arriveBy) ? travel.arriveBy : "",
      }
    : null;
  const tp = travelNumbers ? travelPlan(travelNumbers) : null;

  return (
    <>
      <section className="card p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Day-by-day schedule</h2>
          <span className="text-lg font-semibold">{formatCents(totals.dayTotals.reduce((s, x) => s + x.labor, 0))}</span>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Each day prints with its date, start time, addresses, scope and crew. Crew rates come from the rate card; change any rate for this quote.
        </p>
        <div className="space-y-5">
          {plan.days.map((d, i) => {
            const t = totals.dayTotals[i]!;
            return (
              <div key={d.key} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Day {i + 1}</h3>
                  <div className="flex gap-3 text-sm">
                    <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => copyDay(d)}>Copy day</button>
                    <button type="button" className="text-slate-500 hover:text-red-600" onClick={() => onChange({ ...plan, days: plan.days.filter((x) => x.key !== d.key) })}>
                      Remove
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Title" value={d.title} onChange={(v) => setDay(d.key, { title: v })} placeholder="Pick Up, Delivery and Set Up" className="sm:col-span-2" />
                  <Field label="Date" value={d.date} onChange={(v) => setDay(d.key, { date: v })} placeholder="Tuesday, October 20th, 2026 or TBD" />
                  <Field label="Start time" value={d.startTime} onChange={(v) => setDay(d.key, { startTime: v })} placeholder="6:00 AM – 7:00 AM or TBD" />
                  <Field label="Origin" value={d.origin} onChange={(v) => setDay(d.key, { origin: v })} placeholder="Address, floor" />
                  <Field label="Destination" value={d.destination} onChange={(v) => setDay(d.key, { destination: v })} placeholder="Address, floor (optional)" />
                  <div className="sm:col-span-2">
                    <label className="label">Scope for the day (one item per line)</label>
                    <textarea className="input" rows={4} value={d.scope} onChange={(e) => setDay(d.key, { scope: e.target.value })} />
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="table min-w-[560px]">
                    <thead>
                      <tr>
                        <th>Crew role</th>
                        <th className="w-20">Count</th>
                        <th className="w-28">Rate ($/hr)</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {d.crew.map((c) => (
                        <tr key={c.key}>
                          <td><input className="input" value={c.role} onChange={(e) => setCrew(d, c.key, { role: e.target.value })} /></td>
                          <td><input className="input" inputMode="numeric" value={c.count} onChange={(e) => setCrew(d, c.key, { count: e.target.value })} /></td>
                          <td><input className="input" inputMode="decimal" value={c.rate} onChange={(e) => setCrew(d, c.key, { rate: e.target.value })} /></td>
                          <td className="px-1">
                            <button type="button" aria-label="Remove crew row" className="text-slate-400 hover:text-red-600" onClick={() => setDay(d.key, { crew: d.crew.filter((x) => x.key !== c.key) })}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap items-start gap-3">
                  <RatePicker
                    label="Add crew from rate card"
                    rates={crewRates}
                    price={price}
                    onPick={(r) => setDay(d.key, { crew: [...d.crew, { key: k("crew"), role: r.name, count: "1", rate: dollars(price(r)) }] })}
                  />
                  <button type="button" className="btn" onClick={() => setDay(d.key, { crew: [...d.crew, { key: k("crew"), role: "", count: "1", rate: "" }] })}>
                    Add custom role
                  </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <Field label="Hours" inputMode="decimal" value={d.hours} onChange={(v) => setDay(d.key, { hours: v })} />
                  <Field label="Trucks" inputMode="numeric" value={d.trucks} onChange={(v) => setDay(d.key, { trucks: v })} />
                  <Field label="Truck type" value={d.truckLabel} onChange={(v) => setDay(d.key, { truckLabel: v })} />
                  <Field label="Truckloads out (cost analysis)" inputMode="decimal" value={d.loads} onChange={(v) => setDay(d.key, { loads: v })} />
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {crewHeadline({
                    crew: d.crew.map((c) => ({ role: c.role, count: Number(c.count) || 0, rateCents: 0 })),
                    hours: Number(d.hours) || 0,
                    trucks: Number(d.trucks) || 0,
                    truckLabel: d.truckLabel,
                  })}
                  {" · "}
                  <strong>
                    {formatCents(t.rate)}/hr × {d.hours || 0} hours = {formatCents(t.labor)}
                  </strong>
                </p>
              </div>
            );
          })}
        </div>
        <button type="button" className="btn mt-4" onClick={() => onChange({ ...plan, days: [...plan.days, emptyDay()] })}>Add day</button>
      </section>

      <section className="card p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Materials and equipment</h2>
          <span className="text-lg font-semibold">{formatCents(totals.materialTotals.reduce((s, x) => s + x, 0))}</span>
        </div>
        <p className="mb-4 text-sm text-slate-500">Priced items add to the total; items marked free print as &ldquo;Free Rental&rdquo;.</p>
        {plan.materials.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="w-20">Qty</th>
                  <th className="w-28">Unit</th>
                  <th className="w-28">Rate ($)</th>
                  <th className="w-20">Free</th>
                  <th className="w-24 text-right">Amount</th>
                  <th>Note</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {plan.materials.map((m, i) => (
                  <tr key={m.key}>
                    <td><input className="input" value={m.name} onChange={(e) => setMat(m.key, { name: e.target.value })} /></td>
                    <td><input className="input" inputMode="decimal" value={m.quantity} onChange={(e) => setMat(m.key, { quantity: e.target.value })} /></td>
                    <td><input className="input" value={m.unit} onChange={(e) => setMat(m.key, { unit: e.target.value })} /></td>
                    <td><input className="input" inputMode="decimal" value={m.rate} disabled={m.free} onChange={(e) => setMat(m.key, { rate: e.target.value })} /></td>
                    <td className="text-center"><input type="checkbox" checked={m.free} onChange={(e) => setMat(m.key, { free: e.target.checked })} /></td>
                    <td className="whitespace-nowrap pt-4 text-right font-medium">{m.free ? "Free" : formatCents(totals.materialTotals[i]!)}</td>
                    <td><input className="input" value={m.note} placeholder="to double stack chairs" onChange={(e) => setMat(m.key, { note: e.target.value })} /></td>
                    <td className="px-1">
                      <button type="button" aria-label="Remove item" className="text-slate-400 hover:text-red-600" onClick={() => onChange({ ...plan, materials: plan.materials.filter((x) => x.key !== m.key) })}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <RatePicker
            label="Add from rate card"
            rates={materialRates}
            price={price}
            onPick={(r) =>
              onChange({
                ...plan,
                materials: [
                  ...plan.materials,
                  { key: k("mat"), name: r.name, quantity: "1", unit: r.unit, rate: dollars(price(r)), free: isFreeByDefault(r), note: "" },
                ],
              })
            }
          />
          <button
            type="button"
            className="btn"
            onClick={() => onChange({ ...plan, materials: [...plan.materials, { key: k("mat"), name: "", quantity: "1", unit: "each", rate: "", free: false, note: "" }] })}
          >
            Add custom item
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Travel planner</h2>
        <p className="mb-4 text-sm text-slate-500">
          Enter the car drive time from your mapping app. Trucks get a {DEFAULT_TRUCK_BUFFER_PCT}% buffer, and the planner works back from the time you must arrive.
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Car drive time (min)" inputMode="numeric" value={travel?.carMinutes ?? ""} onChange={(v) => setTravel({ carMinutes: v })} placeholder="60" />
          <Field label="Truck buffer (%)" inputMode="numeric" value={travel?.bufferPct ?? String(DEFAULT_TRUCK_BUFFER_PCT)} onChange={(v) => setTravel({ bufferPct: v })} />
          <Field label="Loading time (min)" inputMode="numeric" value={travel?.loadMinutes ?? ""} onChange={(v) => setTravel({ loadMinutes: v })} placeholder="90" />
          <Field label="Must arrive by" type="time" value={travel?.arriveBy ?? ""} onChange={(v) => setTravel({ arriveBy: v })} />
        </div>
        {tp && travelNumbers && travelNumbers.carMinutes > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span>Truck travel: <strong>{tp.truckMinutes} min</strong></span>
            {tp.departBy && <span>Depart by: <strong>{tp.departBy}</strong></span>}
            {tp.latestStart && <span>Latest start: <strong>{tp.latestStart}</strong></span>}
            <button
              type="button"
              className="btn"
              onClick={() => onChange({ ...plan, assumptions: [plan.assumptions.trim(), `• ${travelSentence(travelNumbers)}`].filter(Boolean).join("\n") })}
            >
              Add to assumptions
            </button>
            <button type="button" className="text-slate-500 hover:text-red-600" onClick={() => onChange({ ...plan, travel: null })}>Clear</button>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Assumptions and exclusions</h2>
        <p className="mb-3 text-sm text-slate-500">Printed under the Financial Investment. Start a line with • or - for a bullet.</p>
        <textarea className="input" rows={6} value={plan.assumptions} onChange={(e) => onChange({ ...plan, assumptions: e.target.value })} />
      </section>
    </>
  );
}
