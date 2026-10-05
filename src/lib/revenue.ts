import { db } from "./db";

// Revenue lines by month for Revenue > Year over year. Each line (such as "Actual Rev") comes from
// Power BI, with any pasted, uploaded or typed month taking its place.

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Power BI's Commercial Revenue splits into these types; the page also shows their total.
export const TOTAL_LINE = "Commercial Revenue";
export const DEFAULT_LINES = ["Actual Rev", "Corporate Account"];
// Types in the Power BI table that aren't revenue.
export const isIgnoredLine = (name: string) => /budget|forecast|target/i.test(name);

export type MonthRevenue = { month: number; amount: number; source: "POWERBI" | "PASTE" | "UPLOAD" | "TYPED" | null };
export type Line = { name: string; months: MonthRevenue[] };

export async function revenueLines(companyId: string, names: string[], year: number): Promise<Line[]> {
  const [entries, pbi] = await Promise.all([
    db.revenueEntry.findMany({ where: { companyId, year, series: { in: names } } }),
    db.powerBiRevenue.findMany({ where: { companyId, year, series: { in: names } } }),
  ]);
  return names.map((name) => ({
    name,
    months: MONTHS.map((_, i) => {
      const e = entries.find((r) => r.series === name && r.month === i + 1);
      if (e) return { month: i + 1, amount: e.amount, source: e.source as MonthRevenue["source"] };
      const p = pbi.find((r) => r.series === name && r.month === i + 1);
      return p ? { month: i + 1, amount: p.amount, source: "POWERBI" as const } : { month: i + 1, amount: 0, source: null };
    }),
  }));
}

// The total of several lines, month by month.
export function totalLine(name: string, lines: Line[]): Line {
  return {
    name,
    months: MONTHS.map((_, i) => {
      const ms = lines.map((l) => l.months[i]);
      return { month: i + 1, amount: ms.reduce((s, m) => s + m.amount, 0), source: ms.find((m) => m.source)?.source ?? null };
    }),
  };
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
