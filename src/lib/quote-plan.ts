import { z } from "zod";

// The structured part of a quote: the day-by-day schedule with its crew, the materials and equipment
// list, the travel planner and the assumptions. Stored as JSON on Quote.plan. Money is in integer cents.

export const DEFAULT_TRUCK_BUFFER_PCT = 25;

const text = (max = 2000) => z.string().trim().max(max).default("");

export const CrewRow = z.object({
  role: z.string().trim().min(1, "Every crew row needs a role").max(200),
  count: z.number().int().min(0, "Crew counts can't be negative").max(500),
  rateCents: z.number().int().min(0, "Crew rates can't be negative"),
});

export const PlanDay = z.object({
  title: text(300),
  date: text(100),
  startTime: text(300),
  origin: text(500),
  destination: text(500),
  scope: text(10000),
  crew: z.array(CrewRow).default([]),
  hours: z.number().finite().min(0).max(24).default(8),
  trucks: z.number().int().min(0).max(100).default(0),
  truckLabel: text(200),
  // Truckloads moved out that day; used by the cost analysis only.
  loads: z.number().finite().min(0).max(1000).default(0),
});

export const PlanMaterial = z.object({
  name: z.string().trim().min(1, "Every material needs a name").max(300),
  quantity: z.number().finite().min(0).default(1),
  unit: text(100),
  rateCents: z.number().int().min(0).default(0),
  free: z.boolean().default(false),
  note: text(300),
});

export const PlanTravel = z.object({
  carMinutes: z.number().int().min(0).max(24 * 60).default(0),
  bufferPct: z.number().int().min(0).max(200).default(DEFAULT_TRUCK_BUFFER_PCT),
  loadMinutes: z.number().int().min(0).max(24 * 60).default(0),
  arriveBy: z
    .string()
    .trim()
    .regex(/^$|^\d{2}:\d{2}$/, "Enter the arrival time as HH:MM")
    .default(""),
});

export const QuotePlan = z.object({
  days: z.array(PlanDay).default([]),
  materials: z.array(PlanMaterial).default([]),
  travel: PlanTravel.nullable().default(null),
  assumptions: text(20000),
});

export type CrewRowT = z.output<typeof CrewRow>;
export type PlanDayT = z.output<typeof PlanDay>;
export type PlanMaterialT = z.output<typeof PlanMaterial>;
export type PlanTravelT = z.output<typeof PlanTravel>;
export type QuotePlanT = z.output<typeof QuotePlan>;

export const EMPTY_PLAN: QuotePlanT = { days: [], materials: [], travel: null, assumptions: "" };

// Reads whatever is stored in Quote.plan; anything unreadable becomes an empty plan.
export function readPlan(value: unknown): QuotePlanT {
  if (value == null) return EMPTY_PLAN;
  const parsed = QuotePlan.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_PLAN;
}

// ---------- crew and day labor ----------

export function crewRateCents(crew: Pick<CrewRowT, "count" | "rateCents">[]): number {
  return crew.reduce((s, c) => s + c.count * c.rateCents, 0);
}

export function crewPeople(crew: Pick<CrewRowT, "count">[]): number {
  return crew.reduce((s, c) => s + c.count, 0);
}

export function dayLaborCents(day: Pick<PlanDayT, "crew" | "hours">): number {
  return Math.round(crewRateCents(day.crew) * day.hours);
}

// "(3) Movers" rather than "(3) Mover" when the role is singular.
export function crewLabel(row: Pick<CrewRowT, "role" | "count">): string {
  const role = row.role.trim();
  const plural = row.count > 1 && !/s$/i.test(role) && !/[&/]/.test(role) ? `${role}s` : role;
  return `(${row.count}) ${plural}`;
}

// "5 Moving Specialists and 1 Straight Truck w/liftgate for 8 hours including travel"
export function crewHeadline(day: Pick<PlanDayT, "crew" | "hours" | "trucks" | "truckLabel">): string {
  const people = crewPeople(day.crew);
  const label = day.truckLabel.trim() || "Straight Truck w/liftgate";
  const trucks = day.trucks > 0 ? ` and ${day.trucks} ${day.trucks === 1 ? label : pluralTruck(label)}` : "";
  return `${people} Moving Specialist${people === 1 ? "" : "s"}${trucks} for ${formatHours(day.hours)} hours including travel`;
}

function pluralTruck(label: string): string {
  return label.replace(/\bTruck\b/, "Trucks");
}

function formatHours(h: number): string {
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

// ---------- materials ----------

export function materialAmountCents(m: Pick<PlanMaterialT, "quantity" | "rateCents" | "free">): number {
  return m.free ? 0 : Math.round(m.quantity * m.rateCents);
}

export function materialsCents(materials: Pick<PlanMaterialT, "quantity" | "rateCents" | "free">[]): number {
  return materials.reduce((s, m) => s + materialAmountCents(m), 0);
}

// ---------- totals ----------

export function planTotalCents(plan: Pick<QuotePlanT, "days" | "materials">): number {
  return plan.days.reduce((s, d) => s + dayLaborCents(d), 0) + materialsCents(plan.materials);
}

// The rows of the Financial Investment section the plan contributes: one per day with labor, then materials.
export function planInvestmentRows(plan: Pick<QuotePlanT, "days" | "materials">): { label: string; amountCents: number }[] {
  const rows: { label: string; amountCents: number }[] = [];
  plan.days.forEach((d, i) => {
    const amount = dayLaborCents(d);
    if (amount > 0 || d.crew.length) rows.push({ label: `${dayName(d, i, plan.days.length)} Labor`, amountCents: amount });
  });
  const mats = materialsCents(plan.materials);
  if (plan.materials.length) rows.push({ label: "Materials and Equipment", amountCents: mats });
  return rows;
}

export function dayName(day: Pick<PlanDayT, "title">, index: number, count: number): string {
  if (day.title.trim()) return count > 1 ? `Day ${index + 1}: ${day.title.trim()}` : day.title.trim();
  return count > 1 ? `Day ${index + 1}` : "Project";
}

// ---------- travel planner ----------

// Trucks are slower than the car time a mapping app gives, so a buffer (25% by default) is added.
export function truckMinutes(carMinutes: number, bufferPct = DEFAULT_TRUCK_BUFFER_PCT): number {
  return Math.ceil(carMinutes * (1 + bufferPct / 100));
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatClock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

export type TravelPlan = { truckMinutes: number; departBy: string | null; latestStart: string | null };

// Works back from the required arrival: depart by = arrival - truck travel; latest start = depart - loading time.
export function travelPlan(t: PlanTravelT): TravelPlan {
  const truck = truckMinutes(t.carMinutes, t.bufferPct);
  const arrive = toMinutes(t.arriveBy);
  if (arrive == null) return { truckMinutes: truck, departBy: null, latestStart: null };
  const depart = arrive - truck;
  return { truckMinutes: truck, departBy: formatClock(depart), latestStart: formatClock(depart - t.loadMinutes) };
}

export function travelSentence(t: PlanTravelT): string {
  const p = travelPlan(t);
  const base = `Travel time estimated at ${p.truckMinutes} minutes: ${t.carMinutes} minutes car time plus a ${t.bufferPct}% buffer for truck travel.`;
  if (!p.latestStart || !p.departBy) return base;
  return `${base} To arrive by ${formatClock(toMinutes(t.arriveBy)!)}, trucks depart by ${p.departBy}${
    t.loadMinutes ? ` and loading starts no later than ${p.latestStart}` : ""
  }.`;
}

// ---------- cost analysis ----------

const LOAD_AND_GO = /driver|truck|mover/i;

export type DayAnalysis = {
  name: string;
  people: number;
  crewRateCents: number;
  blendedRateCents: number;
  laborCents: number;
  manHours: number;
  loads: number;
  loadAndGoPerTruckCents: number | null;
  allInPerTruckCents: number | null;
};

// Blended rate per man, load-and-go cost per truckload (trucks, drivers and movers only) and
// all-in cost per truckload (day labor plus its share of materials, spread by labor).
export function analyzePlan(plan: Pick<QuotePlanT, "days" | "materials">, extraCents = 0) {
  const totalLabor = plan.days.reduce((s, d) => s + dayLaborCents(d), 0);
  const overhead = materialsCents(plan.materials) + extraCents;
  const days: DayAnalysis[] = plan.days.map((d, i) => {
    const people = crewPeople(d.crew);
    const rate = crewRateCents(d.crew);
    const labor = dayLaborCents(d);
    const lgRate = crewRateCents(d.crew.filter((c) => LOAD_AND_GO.test(c.role)));
    const share = totalLabor > 0 ? Math.round((overhead * labor) / totalLabor) : 0;
    return {
      name: dayName(d, i, plan.days.length),
      people,
      crewRateCents: rate,
      blendedRateCents: people ? Math.round(rate / people) : 0,
      laborCents: labor,
      manHours: people * d.hours,
      loads: d.loads,
      loadAndGoPerTruckCents: d.loads > 0 ? Math.round((lgRate * d.hours) / d.loads) : null,
      allInPerTruckCents: d.loads > 0 ? Math.round((labor + share) / d.loads) : null,
    };
  });
  const manHours = days.reduce((s, d) => s + d.manHours, 0);
  const loads = days.reduce((s, d) => s + d.loads, 0);
  return {
    days,
    totalLaborCents: totalLabor,
    overheadCents: overhead,
    manHours,
    loads,
    blendedRateCents: manHours ? Math.round(totalLabor / manHours) : 0,
    allInPerTruckCents: loads ? Math.round((totalLabor + overhead) / loads) : null,
  };
}
