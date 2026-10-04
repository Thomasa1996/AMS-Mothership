import ExcelJS from "exceljs";
import { cleanText } from "./vendor-import";

// Reads the "Apple Moving Branch Profiles" workbook: one sheet per branch, plus a
// "Warehouse capacity" summary sheet and a blank "Profile Template" (both skipped here).
//
// Each branch sheet has labels in column A and one value column per warehouse (B, C, D). Some
// older sheets also carry a second "Contact Info" block further right; its values fill gaps
// in the main block.

export type BranchContact = { name: string | null; title: string; phone: string | null; email: string | null };
export type BranchWarehouse = { address: string | null; cityStateZip: string | null };
export type BranchFact = { label: string; values: string[] };
export type BranchSection = { title: string; facts: BranchFact[] };

export type BranchRow = {
  name: string;
  position: number;
  profileDate: string | null;
  approval: string | null;
  warehouses: BranchWarehouse[];
  contacts: BranchContact[];
  profile: BranchSection[];
};

const SKIP_SHEETS = new Set(["warehouse capacity", "profile template"]);

// Section headings as they appear in column A (normalized).
const SECTIONS: [RegExp, string][] = [
  [/^warehouse overview$/, "Warehouse overview"],
  [/^equipment \/ performance overview$/, "Equipment and performance"],
  [/^labor overview$/, "Labor"],
  [/^insurance \/ safety overview$/, "Insurance and safety"],
  [/^equipment quantit(y|ies)/, "Equipment quantities"],
];

const norm = (s: string) => s.replace(/\s+/g, " ").replace(/[:\s]+$/, "").trim().toLowerCase();
// Labels are cleaned of stray spaces and trailing colons for display.
const tidyLabel = (s: string) => s.replace(/\s+/g, " ").replace(/[:\s]+$/, "").trim();

type Grid = (string | null)[][];

function cell(grid: Grid, r: number, c: number) {
  return grid[r]?.[c] ?? null;
}

function findRow(grid: Grid, col: number, test: (v: string) => boolean, from = 0) {
  for (let r = from; r < grid.length; r++) {
    const v = cell(grid, r, col);
    if (v && test(norm(v))) return r;
  }
  return -1;
}

// "Date: 9/13/24" or a real date cell.
function profileDate(raw: string | null) {
  if (!raw) return null;
  const v = raw.replace(/^date:?\s*/i, "").trim();
  return v || null;
}

export function sheetToBranch(name: string, grid: Grid, position: number): BranchRow {
  // Warehouses: a "Warehouse 1 | Warehouse 2" header row above the address row means several.
  const addrRow = findRow(grid, 0, (v) => v.startsWith("warehouse address"));
  const cityRow = findRow(grid, 0, (v) => v.startsWith("warehouse city"));
  let warehouseCols = [1];
  const header = addrRow > 0 ? grid[addrRow - 1] ?? [] : [];
  const numbered = header.map((v, i) => (v && /^warehouse \d/i.test(v) ? i : -1)).filter((i) => i > 0);
  if (numbered.length > 1) warehouseCols = numbered;
  const warehouses = warehouseCols
    .map((c) => ({ address: cell(grid, addrRow, c), cityStateZip: cell(grid, cityRow, c) }))
    .filter((w) => w.address || w.cityStateZip);

  // Contacts: rows under the "Contacts Name | Title | Phone | Email" header.
  const contacts: BranchContact[] = [];
  const contactHeader = findRow(grid, 0, (v) => v === "contacts name");
  if (contactHeader >= 0) {
    for (let r = contactHeader + 1; r < grid.length; r++) {
      const [n, t, p, e] = [0, 1, 2, 3].map((c) => cell(grid, r, c));
      if (!n && !t && !p && !e) break;
      if (n && SECTIONS.some(([re]) => re.test(norm(n)))) break;
      if (!n && !p && !e) continue; // a title with nobody filled in
      contacts.push({ name: n, title: t ?? "Contact", phone: p, email: e });
    }
  }

  // Profile sections in column A.
  const valueCols = warehouseCols;
  const profile: BranchSection[] = [];
  let current: BranchSection | null = null;
  const start = contactHeader >= 0 ? contactHeader + 1 : 0;
  for (let r = start; r < grid.length; r++) {
    const label = cell(grid, r, 0);
    if (!label) continue;
    const section = SECTIONS.find(([re]) => re.test(norm(label)));
    if (section) {
      current = { title: section[1], facts: [] };
      profile.push(current);
      continue;
    }
    if (!current) continue;
    current.facts.push({ label: tidyLabel(label), values: valueCols.map((c) => cell(grid, r, c) ?? "") });
  }

  // Older "Contact Info" block on the right: fill blank facts and missing contacts.
  const sideCol = (grid[0] ?? []).findIndex((v, i) => i > 3 && v && norm(v) === "contact info");
  if (sideCol > 0) {
    const allFacts = new Map(profile.flatMap((s) => s.facts).map((f) => [norm(f.label), f]));
    const extra: BranchFact[] = [];
    for (let r = 1; r < grid.length; r++) {
      const label = cell(grid, r, sideCol);
      if (!label) continue;
      const key = norm(label);
      const [v1, v2, v3] = [1, 2, 3].map((d) => cell(grid, r, sideCol + d));
      if (["general manager", "warehouse manager", "after hours poc", "operations manager", "local dispatch"].includes(key)) {
        if (!v1 && !v2 && !v3) continue;
        const existing = contacts.find((c) => norm(c.title) === key);
        if (existing) {
          existing.name ??= v1;
          existing.phone ??= v2;
          existing.email ??= v3;
        } else {
          contacts.push({ name: v1, title: tidyLabel(label), phone: v2, email: v3 });
        }
        continue;
      }
      if (key === "warehouse address" && v1 && warehouses.length === 0) {
        warehouses.push({ address: v1, cityStateZip: null });
        continue;
      }
      if (!v1 || ["name", "contact info"].includes(key)) continue;
      const fact = allFacts.get(key);
      if (fact) {
        if (!fact.values[0]) fact.values[0] = v1;
      } else {
        extra.push({ label: tidyLabel(label), values: [v1] });
      }
    }
    if (extra.length) profile.push({ title: "Other details", facts: extra });
  }

  return {
    name: name.trim(),
    position,
    profileDate: profileDate(cell(grid, 0, 1)),
    approval: cell(grid, 0, 2),
    warehouses,
    contacts,
    profile,
  };
}

function sheetGrid(sheet: ExcelJS.Worksheet): Grid {
  const grid: Grid = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    grid[rowNumber - 1] = values.map((v) => {
      if (v instanceof Date) return `${v.getUTCMonth() + 1}/${v.getUTCDate()}/${v.getUTCFullYear()}`;
      return cleanText(v);
    });
  });
  for (let i = 0; i < grid.length; i++) grid[i] ??= [];
  return grid;
}

export async function parseBranchWorkbook(data: ArrayBuffer | Buffer): Promise<BranchRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as ArrayBuffer);
  const branches: BranchRow[] = [];
  workbook.eachSheet((sheet) => {
    if (SKIP_SHEETS.has(norm(sheet.name))) return;
    const grid = sheetGrid(sheet);
    if (!grid[0]?.[0] || !/warehouse profile/i.test(grid[0][0])) return;
    branches.push(sheetToBranch(sheet.name, grid, branches.length));
  });
  return branches;
}

// Looks up a fact by label across sections, for list views ("Total Square Feet" etc.).
export function factValues(profile: BranchSection[], label: string): string[] {
  const key = norm(label);
  for (const s of profile) for (const f of s.facts) if (norm(f.label) === key) return f.values;
  return [];
}
