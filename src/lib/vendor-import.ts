import ExcelJS from "exceljs";
import { MISSING_COMPANY } from "./constants";

// Reads a vendor workbook (one sheet per vendor category) into flat vendor rows.
// Matches the layout of the "Apple Moving - Vendor File" spreadsheet but tolerates
// extra or missing columns, since headers are matched by name.

export type VendorRow = {
  category: string;
  // Row order within its sheet, so the list can show vendors as the file had them.
  position: number;
  name: string;
  memberId: string | null;
  state: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  markets: string | null;
  verificationStatus: string | null;
  currentEmployer: string | null;
  previousContact: string | null;
  notes: string | null;
};

type Field = Exclude<keyof VendorRow, "category" | "position">;

// Normalized header text -> field. Headers are lowercased with punctuation removed.
const HEADER_MAP: Record<string, Field> = {
  "company": "name",
  "company name": "name",
  "vendor": "name",
  "member id": "memberId",
  "state": "state",
  "contact name": "contactName",
  "cmg contact": "contactName",
  "contact": "contactName",
  "phone": "phone",
  "email": "email",
  "address": "address",
  "website": "website",
  "markets": "markets",
  "apollo verification status": "verificationStatus",
  "verification status": "verificationStatus",
  "current employer if changed": "currentEmployer",
  "previous contact on file before update": "previousContact",
  "notes": "notes",
};

export function normalizeHeader(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanText(value: unknown): string | null {
  const text = cellToString(value)
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
  return text ? text : null;
}

export function cleanCategory(sheetName: string): string {
  return sheetName.replace(/\s+/g, " ").trim();
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) return v.richText.map((r: { text?: string }) => r.text ?? "").join("");
    if ("text" in v) return cellToString(v.text);
    if ("result" in v) return cellToString(v.result);
    if ("hyperlink" in v) return cellToString(v.hyperlink);
  }
  return "";
}

export { MISSING_COMPANY };

export function emailDomain(email: string | null): string | null {
  const match = email?.toLowerCase().match(/@([a-z0-9.-]+)/);
  return match ? match[1]! : null;
}

// Turns one sheet's raw rows (header first) into vendor rows.
// A row with no company takes the company above it only when its email shares that row's
// domain (another contact at the same vendor). Otherwise the company is marked as not listed
// rather than guessed, so the team can fix it.
export function rowsToVendors(category: string, rows: unknown[][]): VendorRow[] {
  const headerIndex = rows.findIndex((r) => r.some((c) => cleanText(c)));
  if (headerIndex === -1) return [];
  const fieldByColumn = rows[headerIndex]!.map((h) => HEADER_MAP[normalizeHeader(cleanText(h) ?? "")]);
  if (!fieldByColumn.includes("name")) return [];

  const vendors: VendorRow[] = [];
  let last: VendorRow | null = null;

  for (const raw of rows.slice(headerIndex + 1)) {
    const row: VendorRow = {
      category,
      position: vendors.length,
      name: "",
      memberId: null,
      state: null,
      contactName: null,
      phone: null,
      email: null,
      address: null,
      website: null,
      markets: null,
      verificationStatus: null,
      currentEmployer: null,
      previousContact: null,
      notes: null,
    };
    let hasData = false;
    fieldByColumn.forEach((field, i) => {
      if (!field) return;
      const value = cleanText(raw[i]);
      if (value == null) return;
      hasData = true;
      if (field === "name") row.name = value;
      else row[field] = value;
    });
    if (!hasData) continue;

    if (!row.name) {
      const domain = emailDomain(row.email);
      row.name = last && domain && domain === emailDomain(last.email) ? last.name : MISSING_COMPANY;
    }
    vendors.push(row);
    last = row;
  }
  return vendors;
}

export async function parseVendorWorkbook(data: ArrayBuffer | Buffer): Promise<VendorRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's type for load() lags behind Node's Buffer generics; the runtime accepts both.
  await workbook.xlsx.load(data as ArrayBuffer);
  const vendors: VendorRow[] = [];
  workbook.eachSheet((sheet) => {
    const rows: unknown[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      // row.values is 1-indexed with an empty slot 0.
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values);
    });
    vendors.push(...rowsToVendors(cleanCategory(sheet.name), rows));
  });
  return vendors;
}
