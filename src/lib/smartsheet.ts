// Minimal read-only Smartsheet API 2.0 client for Sales > Project management.
// Sheets are read live on each page view; nothing from Smartsheet is stored in Mothership.

export const SMARTSHEET_REGIONS = [
  { id: "us", label: "Smartsheet (app.smartsheet.com)", api: "https://api.smartsheet.com/2.0" },
  { id: "gov", label: "Smartsheet Gov (app.smartsheetgov.com)", api: "https://api.smartsheetgov.com/2.0" },
  { id: "eu", label: "Smartsheet EU (app.smartsheet.eu)", api: "https://api.smartsheet.eu/2.0" },
  { id: "au", label: "Smartsheet AU (app.smartsheet.au)", api: "https://api.smartsheet.au/2.0" },
] as const;

function apiBase(region: string) {
  if (process.env.SMARTSHEET_API_BASE) return process.env.SMARTSHEET_API_BASE;
  return (SMARTSHEET_REGIONS.find((r) => r.id === region) ?? SMARTSHEET_REGIONS[0]).api;
}

export class SmartsheetError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(token: string, region: string, path: string, attempt = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase(region)}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    throw new SmartsheetError("Couldn't reach Smartsheet. Try again in a minute.", 0);
  }
  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    return request(token, region, path, attempt + 1);
  }
  if (!res.ok) {
    if (res.status === 401) {
      throw new SmartsheetError("Smartsheet didn't accept the token. Check it was copied in full, and that the right Smartsheet version is picked.", 401);
    }
    if (res.status === 403) throw new SmartsheetError("The Smartsheet account behind this token can't open that sheet.", 403);
    if (res.status === 404) throw new SmartsheetError("That sheet wasn't found in Smartsheet. It may have been deleted or unshared.", 404);
    throw new SmartsheetError(`Smartsheet returned an error (${res.status}). Try again in a few minutes.`, res.status);
  }
  return (await res.json()) as T;
}

export type SmartsheetUser = { id: number; email: string; firstName?: string; lastName?: string };
export type SheetSummary = { id: number; name: string; permalink?: string; modifiedAt?: string };
export type SheetColumn = { id: number; index: number; title: string; type: string; primary?: boolean; hidden?: boolean };
export type SheetCell = { columnId: number; value?: unknown; displayValue?: string };
export type SheetRow = { id: number; rowNumber: number; parentId?: number; cells: SheetCell[] };
export type Sheet = { id: number; name: string; permalink?: string; modifiedAt?: string; totalRowCount?: number; columns: SheetColumn[]; rows: SheetRow[] };

export const getMe = (token: string, region: string) => request<SmartsheetUser>(token, region, "/users/me");

export async function listSheets(token: string, region: string) {
  const res = await request<{ data: SheetSummary[] }>(token, region, "/sheets?includeAll=true");
  return res.data.sort((a, b) => a.name.localeCompare(b.name));
}

export const getSheet = (token: string, region: string, sheetId: string) =>
  request<Sheet>(token, region, `/sheets/${encodeURIComponent(sheetId)}`);

// Turns a sheet into plain rows for display: visible columns only, each cell as text, and each
// row's indent level from its parent chain (Smartsheet's hierarchy).
export type TableRow = { id: number; depth: number; cells: string[] };

export function cellText(cell: SheetCell | undefined, type: string): string {
  if (!cell) return "";
  if (type === "CHECKBOX") return cell.value === true ? "✓" : "";
  if (cell.displayValue != null) return cell.displayValue;
  if (cell.value == null) return "";
  return String(cell.value);
}

export function sheetTable(sheet: Sheet) {
  const columns = sheet.columns.filter((c) => !c.hidden).sort((a, b) => a.index - b.index);
  const depthOf = new Map<number, number>();
  const rows: TableRow[] = sheet.rows.map((r) => {
    const depth = r.parentId != null ? (depthOf.get(r.parentId) ?? 0) + 1 : 0;
    depthOf.set(r.id, depth);
    const byColumn = new Map(r.cells.map((c) => [c.columnId, c]));
    return { id: r.id, depth, cells: columns.map((c) => cellText(byColumn.get(c.id), c.type)) };
  });
  return { columns: columns.map((c) => ({ title: c.title, primary: !!c.primary })), rows };
}

export async function getColumns(token: string, region: string, sheetId: string) {
  const res = await request<{ data: SheetColumn[] }>(token, region, `/sheets/${encodeURIComponent(sheetId)}/columns?includeAll=true`);
  return res.data.sort((a, b) => a.index - b.index);
}
