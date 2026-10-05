import { db } from "./db";
import { WON_STAGES } from "./constants";

// Revenue by month for Revenue > Year over year. A month's figure is the total an admin typed in
// for it, when there is one; otherwise the value of projects won that month (by close date, or
// move date when a project has no close date).

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type MonthRevenue = { month: number; amount: number; entered: boolean; projects: number };

export async function monthlyRevenue(companyId: string, year: number): Promise<MonthRevenue[]> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const [entered, projects] = await Promise.all([
    db.revenueMonth.findMany({ where: { companyId, year } }),
    db.project.findMany({
      where: {
        companyId,
        stage: { in: WON_STAGES },
        estimatedValue: { not: null },
        OR: [{ closedAt: { gte: start, lt: end } }, { closedAt: null, moveDate: { gte: start, lt: end } }],
      },
      select: { closedAt: true, moveDate: true, estimatedValue: true },
    }),
  ]);
  const won = Array.from({ length: 12 }, () => ({ amount: 0, projects: 0 }));
  for (const p of projects) {
    const m = (p.closedAt ?? p.moveDate)!.getUTCMonth();
    won[m].amount += p.estimatedValue ?? 0;
    won[m].projects++;
  }
  return won.map((w, i) => {
    const typed = entered.find((e) => e.month === i + 1);
    return typed ? { month: i + 1, amount: typed.amount, entered: true, projects: 0 } : { month: i + 1, amount: w.amount, entered: false, projects: w.projects };
  });
}

export type Change = { amount: number; percent: number | null };

export function change(before: number, after: number): Change {
  return { amount: after - before, percent: before > 0 ? ((after - before) / before) * 100 : null };
}

// Totals for months 1..through in both years, so a year in progress is compared like for like.
export function yearToDate(prev: number[], cur: number[], through: number) {
  const sum = (xs: number[]) => xs.slice(0, through).reduce((a, b) => a + b, 0);
  const before = sum(prev);
  const after = sum(cur);
  return { before, after, ...change(before, after) };
}

// "$12,500.00", "12500", "12.5k" -> 12500. Blank -> null. Anything else -> NaN.
export function parseDollars(text: string): number | null {
  const t = text.replace(/[$,\s]/g, "").toLowerCase();
  if (!t) return null;
  const m = t.match(/^(-?\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return NaN;
  const n = Number(m[1]) * (m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1);
  return Math.round(n);
}
