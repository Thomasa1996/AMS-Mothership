import ExcelJS from "exceljs";

// Reads monthly revenue out of a file exported from Power BI (Export data on a visual, as .xlsx or
// .csv). Power BI exports come in a few shapes, so this accepts:
//   - a date column (2025-01-15, 1/15/2025, "January 2025", "Jan-25") and an amount column
//   - Year and Month columns and an amount column
//   - a matrix: a Year column with one column per month (Jan..Dec)
// Rows for the same month are added together.

export type MonthTotal = { year: number; month: number; amount: number };
export type LineMonth = MonthTotal & { series: string };
type Cell = string | number | Date | null;

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const AMOUNT_HEADER = /revenue|amount|sales|total|sum|value|booked|won|income|\$/;

const norm = (v: Cell) => (v == null ? "" : String(v).trim().toLowerCase());

function monthFrom(v: Cell): number | null {
  if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 12) return v;
  const t = norm(v).replace(/[^a-z0-9]/g, "");
  if (/^\d{1,2}$/.test(t) && +t >= 1 && +t <= 12) return +t;
  const i = MONTH_NAMES.findIndex((m) => t.startsWith(m));
  return i >= 0 ? i + 1 : null;
}

function yearFrom(v: Cell): number | null {
  const n = typeof v === "number" ? v : Number(norm(v));
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
}

export function amountFrom(v: Cell): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let t = norm(v).replace(/[$,\s]/g, "");
  const neg = /^\(.*\)$/.test(t);
  t = t.replace(/[()]/g, "");
  if (!/^-?\d+(\.\d+)?[km]?$/.test(t)) return null;
  const n = parseFloat(t) * (t.endsWith("k") ? 1e3 : t.endsWith("m") ? 1e6 : 1);
  return neg ? -n : n;
}

// Returns [year, month] for a date-like cell.
export function yearMonthFrom(v: Cell): [number, number] | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return [v.getUTCFullYear(), v.getUTCMonth() + 1];
  const t = norm(v);
  if (!t) return null;
  let m = t.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return [+m[1], +m[2]];
  m = t.match(/^(\d{1,2})\/\d{1,2}\/(\d{2,4})/);
  if (m) return [m[2].length === 2 ? 2000 + +m[2] : +m[2], +m[1]];
  m = t.match(/^([a-z]{3,9})[\s\-',]+(\d{2,4})$/);
  if (m && monthFrom(m[1])) return [m[2].length === 2 ? 2000 + +m[2] : +m[2], monthFrom(m[1])!];
  m = t.match(/^(\d{4})[\s\-]+([a-z]{3,9})$/);
  if (m && monthFrom(m[2])) return [+m[1], monthFrom(m[2])!];
  return null;
}

export function parseRevenueRows(rows: Cell[][], defaultYear: number | null = null): MonthTotal[] {
  // The header is the first row with at least two filled cells (exports can start with a title row).
  const h = rows.findIndex((r) => r.filter((c) => norm(c) !== "").length >= 2);
  if (h < 0) throw new Error("The file is empty.");
  const header = rows[h].map(norm);
  const body = rows.slice(h + 1).filter((r) => r.some((c) => norm(c) !== "") && !/^total/.test(norm(r[0])));
  const share = (col: number, test: (v: Cell) => unknown) => {
    const vals = body.map((r) => r[col]).filter((c) => norm(c) !== "");
    return vals.length ? vals.filter((c) => test(c) != null && test(c) !== false).length / vals.length : 0;
  };
  const totals = new Map<string, MonthTotal>();
  const add = (year: number, month: number, amount: number) => {
    const k = `${year}-${month}`;
    const t = totals.get(k) ?? { year, month, amount: 0 };
    t.amount += amount;
    totals.set(k, t);
  };

  // Matrix: month names across the header.
  const monthCols = header.map((c, i) => (MONTH_NAMES.includes(c.slice(0, 3)) && c.length <= 9 ? [i, monthFrom(c)!] : null)).filter(Boolean) as [number, number][];
  if (monthCols.length >= 3) {
    const yearCol = header.findIndex((c, i) => /year/.test(c) || share(i, yearFrom) > 0.8);
    if (yearCol < 0) throw new Error("Found month columns but no Year column.");
    for (const r of body) {
      const y = yearFrom(r[yearCol]);
      if (!y) continue;
      for (const [i, m] of monthCols) {
        const a = amountFrom(r[i]);
        if (a != null) add(y, m, a);
      }
    }
    return finish(totals);
  }

  const cols = header.map((_, i) => i);
  const yearCol = cols.find((i) => /year/.test(header[i]) && share(i, yearFrom) > 0.8) ?? -1;
  const monthCol = cols.find((i) => /month/.test(header[i]) && i !== yearCol && share(i, monthFrom) > 0.8) ?? -1;
  const dateCol =
    yearCol >= 0 && monthCol >= 0
      ? -1
      : (cols.find((i) => /date|month|period/.test(header[i]) && share(i, yearMonthFrom) > 0.8) ?? cols.find((i) => share(i, yearMonthFrom) > 0.8) ?? -1);
  const monthOnly = dateCol < 0 && yearCol < 0 && monthCol >= 0 && defaultYear != null;
  if (dateCol < 0 && !monthOnly && (yearCol < 0 || monthCol < 0)) throw new Error("Couldn't find a date column, or Year and Month columns.");
  const used = new Set([yearCol, monthCol, dateCol]);
  const numeric = cols.filter((i) => !used.has(i) && share(i, amountFrom) > 0.8);
  const amountCol = numeric.find((i) => AMOUNT_HEADER.test(header[i])) ?? numeric[numeric.length - 1];
  if (amountCol == null) throw new Error("Couldn't find a revenue column with dollar amounts.");

  for (const r of body) {
    const y = monthOnly ? defaultYear : yearFrom(r[yearCol]);
    const ym = dateCol >= 0 ? yearMonthFrom(r[dateCol]) : y && monthFrom(r[monthCol]) ? ([y, monthFrom(r[monthCol])!] as [number, number]) : null;
    const a = amountFrom(r[amountCol]);
    if (ym && a != null) add(ym[0], ym[1], a);
  }
  return finish(totals);
}

// Reads a table with a revenue line per row, like Power BI's Category / Month / Type / Sum of Amount
// matrix copied or exported as a table. The line is the Type column (or Category when there is no
// Type); subtotal rows with no Type and "(Blank)" amounts are skipped. With no Year column every row
// is in defaultYear. Tables without a line column are read with parseRevenueRows as one line.
export function parseRevenueLines(rows: Cell[][], defaultYear: number | null, defaultSeries = "Revenue"): LineMonth[] {
  const h = rows.findIndex((r) => r.filter((c) => norm(c) !== "").length >= 2);
  if (h < 0) throw new Error("The table is empty.");
  const header = rows[h].map(norm);
  const body = rows.slice(h + 1);
  const find = (re: RegExp) => header.findIndex((c) => re.test(c));
  const typeCol = find(/^(type|line|series|revenue type)$/);
  const categoryCol = find(/^category$/);
  const lineCol = typeCol >= 0 ? typeCol : categoryCol;
  const monthCol = find(/^month/);
  if (lineCol < 0 || monthCol < 0) {
    const plain = parseRevenueRows(rows.map((r) => r.map((c) => c)), defaultYear);
    return plain.map((m) => ({ ...m, series: defaultSeries }));
  }
  const yearCol = find(/^year$/);
  const used = new Set([lineCol, monthCol, yearCol, categoryCol]);
  const amountCol = header.findIndex((c, i) => !used.has(i) && AMOUNT_HEADER.test(c));
  const col = amountCol >= 0 ? amountCol : header.length - 1;
  const totals = new Map<string, LineMonth>();
  for (const r of body) {
    const series = String(r[lineCol] ?? "").trim();
    const month = monthFrom(r[monthCol]);
    const year = yearCol >= 0 ? yearFrom(r[yearCol]) : defaultYear;
    const amount = amountFrom(r[col]);
    if (!series || /^total/i.test(series) || !month || amount == null) continue;
    if (!year) throw new Error("Pick the year these numbers are for.");
    const k = `${series}|${year}|${month}`;
    const t = totals.get(k) ?? { series, year, month, amount: 0 };
    t.amount += amount;
    totals.set(k, t);
  }
  const out = [...totals.values()].map((t) => ({ ...t, amount: Math.round(t.amount) }));
  if (!out.length) throw new Error("No monthly amounts found.");
  return out.sort((a, b) => a.series.localeCompare(b.series) || a.year - b.year || a.month - b.month);
}

// Text copied from a Power BI table or Excel: tab-separated (or comma-separated) rows.
export function parsePastedRevenue(text: string, defaultYear: number | null): LineMonth[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const rows = lines.some((l) => l.includes("\t")) ? lines.map((l) => l.split("\t")) : parseCsv(lines.join("\n"));
  return parseRevenueLines(rows, defaultYear);
}

function finish(totals: Map<string, MonthTotal>) {
  const out = [...totals.values()].map((t) => ({ ...t, amount: Math.round(t.amount) }));
  if (!out.length) throw new Error("No monthly amounts found in the file.");
  return out.sort((a, b) => a.year - b.year || a.month - b.month);
}

function parseCsv(text: string): Cell[][] {
  const rows: Cell[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cur += '"'), i++;
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") row.push(cur), (cur = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur), rows.push(row), (row = []), (cur = "");
    } else cur += ch;
  }
  if (cur || row.length) row.push(cur), rows.push(row);
  return rows;
}

export async function readRevenueFile(name: string, data: Buffer, defaultYear: number | null): Promise<LineMonth[]> {
  if (name.toLowerCase().endsWith(".csv")) return parseRevenueLines(parseCsv(data.toString("utf8").replace(/^\uFEFF/, "")), defaultYear);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);
  let lastError: unknown = null;
  for (const ws of wb.worksheets) {
    const rows: Cell[][] = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      const vals = (r.values as unknown[]).slice(1).map((v): Cell => {
        if (v && typeof v === "object" && !(v instanceof Date)) {
          const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
          if (o.result !== undefined) return o.result as Cell;
          if (o.richText) return o.richText.map((t) => t.text).join("");
          if (o.text !== undefined) return String(o.text);
          return null;
        }
        return (v ?? null) as Cell;
      });
      rows.push(vals);
    });
    try {
      return parseRevenueLines(rows, defaultYear);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("The workbook has no sheets.");
}
