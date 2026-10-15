import { parseDollarsToCents } from "@/lib/quote-math";
import { crewPeople, crewRateCents, materialAmountCents, type QuotePlanT } from "@/lib/quote-plan";

// Builder state for the structured part of a quote. Inputs are kept as strings while editing and
// converted (and checked) when the quote is saved.

export type CrewDraft = { key: string; role: string; count: string; rate: string };
export type DayDraft = {
  key: string;
  title: string;
  date: string;
  startTime: string;
  origin: string;
  destination: string;
  scope: string;
  crew: CrewDraft[];
  hours: string;
  trucks: string;
  truckLabel: string;
  loads: string;
};
export type MaterialDraft = { key: string; name: string; quantity: string; unit: string; rate: string; free: boolean; note: string };
export type TravelDraft = { carMinutes: string; bufferPct: string; loadMinutes: string; arriveBy: string };
export type PlanDraft = { days: DayDraft[]; materials: MaterialDraft[]; travel: TravelDraft | null; assumptions: string };

let seq = 0;
export const k = (p: string) => `${p}-${Date.now()}-${seq++}`;
export const dollars = (cents: number) => (cents / 100).toFixed(2);

export const EMPTY_PLAN_DRAFT: PlanDraft = { days: [], materials: [], travel: null, assumptions: "" };


export function planDraftFrom(plan: QuotePlanT): PlanDraft {
  return {
    days: plan.days.map((d) => ({
      key: k("day"),
      title: d.title,
      date: d.date,
      startTime: d.startTime,
      origin: d.origin,
      destination: d.destination,
      scope: d.scope,
      crew: d.crew.map((c) => ({ key: k("crew"), role: c.role, count: String(c.count), rate: dollars(c.rateCents) })),
      hours: String(d.hours),
      trucks: String(d.trucks),
      truckLabel: d.truckLabel,
      loads: d.loads ? String(d.loads) : "",
    })),
    materials: plan.materials.map((m) => ({
      key: k("mat"),
      name: m.name,
      quantity: String(m.quantity),
      unit: m.unit,
      rate: dollars(m.rateCents),
      free: m.free,
      note: m.note,
    })),
    travel: plan.travel
      ? {
          carMinutes: String(plan.travel.carMinutes),
          bufferPct: String(plan.travel.bufferPct),
          loadMinutes: String(plan.travel.loadMinutes),
          arriveBy: plan.travel.arriveBy,
        }
      : null,
    assumptions: plan.assumptions,
  };
}

function num(value: string, { int = false } = {}): number | null {
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return int ? Math.round(n) : n;
}

// Turns the draft into the shape the server validates, or explains what to fix.
export function planInput(d: PlanDraft): { plan: QuotePlanT } | { error: string } {
  const days = [];
  for (const [i, day] of d.days.entries()) {
    const label = `Day ${i + 1}`;
    const crew = [];
    for (const c of day.crew) {
      const count = num(c.count, { int: true });
      const rateCents = parseDollarsToCents(c.rate);
      if (!c.role.trim()) return { error: `${label}: every crew row needs a role` };
      if (count == null) return { error: `${label}: enter a crew count for ${c.role}` };
      if (rateCents == null) return { error: `${label}: enter an hourly rate for ${c.role}` };
      crew.push({ role: c.role.trim(), count, rateCents });
    }
    const hours = num(day.hours);
    const trucks = num(day.trucks, { int: true });
    const loads = num(day.loads);
    if (hours == null || hours > 24) return { error: `${label}: enter the hours (0 to 24)` };
    if (trucks == null) return { error: `${label}: enter the number of trucks` };
    if (loads == null) return { error: `${label}: enter the truckloads as a number` };
    days.push({
      title: day.title.trim(),
      date: day.date.trim(),
      startTime: day.startTime.trim(),
      origin: day.origin.trim(),
      destination: day.destination.trim(),
      scope: day.scope,
      crew,
      hours,
      trucks,
      truckLabel: day.truckLabel.trim(),
      loads,
    });
  }
  const materials = [];
  for (const [i, m] of d.materials.entries()) {
    const quantity = num(m.quantity);
    const rateCents = m.free ? (parseDollarsToCents(m.rate) ?? 0) : parseDollarsToCents(m.rate);
    if (!m.name.trim()) return { error: `Material ${i + 1}: enter a name` };
    if (quantity == null) return { error: `${m.name}: enter a quantity` };
    if (rateCents == null) return { error: `${m.name}: enter a dollar amount` };
    materials.push({ name: m.name.trim(), quantity, unit: m.unit.trim(), rateCents, free: m.free, note: m.note.trim() });
  }
  let travel = null;
  if (d.travel) {
    const carMinutes = num(d.travel.carMinutes, { int: true });
    const bufferPct = num(d.travel.bufferPct, { int: true });
    const loadMinutes = num(d.travel.loadMinutes, { int: true });
    if (carMinutes == null || bufferPct == null || loadMinutes == null) return { error: "Travel planner: enter minutes and the buffer as numbers" };
    if (d.travel.arriveBy && !/^\d{2}:\d{2}$/.test(d.travel.arriveBy)) return { error: "Travel planner: enter the arrival time" };
    travel = { carMinutes, bufferPct, loadMinutes, arriveBy: d.travel.arriveBy };
  }
  return { plan: { days, materials, travel, assumptions: d.assumptions } };
}

// Live totals for the builder while editing (invalid inputs count as zero).
export function planDraftTotals(d: PlanDraft) {
  const dayTotals = d.days.map((day) => {
    const crew = day.crew.map((c) => ({ count: num(c.count, { int: true }) ?? 0, rateCents: parseDollarsToCents(c.rate) ?? 0 }));
    const rate = crewRateCents(crew);
    return { rate, people: crewPeople(crew), labor: Math.round(rate * (num(day.hours) ?? 0)) };
  });
  const materialTotals = d.materials.map((m) =>
    materialAmountCents({ quantity: num(m.quantity) ?? 0, rateCents: parseDollarsToCents(m.rate) ?? 0, free: m.free }),
  );
  const total = dayTotals.reduce((s, x) => s + x.labor, 0) + materialTotals.reduce((s, x) => s + x, 0);
  return { dayTotals, materialTotals, total };
}

