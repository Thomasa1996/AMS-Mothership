// Power BI REST API, read-only, signed in as an Azure app (service principal) with the client
// credentials flow. Used to pull monthly revenue out of a Power BI semantic model (dataset) for
// Revenue > Year over year. Nothing in Power BI is changed.

const API = "https://api.powerbi.com/v1.0/myorg";

export class PowerBiError extends Error {}

export type PowerBiCreds = { tenantId: string; clientId: string; secret: string };

// What to read: the date column to group by month, and each revenue line by name with its DAX (a
// measure like [Commercial Revenue], or SUM('Table'[Column])).
export type RevenueSeries = { name: string; amount: string };
export type RevenueSource = { groupId: string; datasetId: string; dateColumn: string; series: RevenueSeries[] };

// The revenue lines Thomas tracks in Power BI, offered first when setting up.
export const DEFAULT_SERIES = ["Commercial Revenue", "Actual Rev", "Corporate Revenue"];

export function parseRevenueSource(raw: string | null): RevenueSource | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw);
    return c && typeof c.groupId === "string" && typeof c.datasetId === "string" && Array.isArray(c.series) ? c : null;
  } catch {
    return null;
  }
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isGuid = (s: string) => GUID.test(s.trim());

// The Directory (tenant) ID is in a saved report link as ctid=...
export function tenantFromLink(url: string): string | null {
  try {
    const t = new URL(url).searchParams.get("ctid");
    return t && isGuid(t) ? t : null;
  } catch {
    return null;
  }
}

function signInError(code: string, fallback: string) {
  if (code.includes("AADSTS90002") || code.includes("AADSTS900023")) return "That Directory (tenant) ID wasn't found. Copy it from the app's Overview page in Azure.";
  if (code.includes("AADSTS700016")) return "No app with that Application (client) ID exists in this directory.";
  if (code.includes("AADSTS7000215") || code.includes("AADSTS7000222")) return "The client secret is wrong or expired. Copy the secret's Value (not its ID), or make a new one.";
  return fallback;
}

export async function getToken(c: PowerBiCreds): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenantId.trim())}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: c.clientId.trim(),
        client_secret: c.secret,
        scope: "https://analysis.windows.net/powerbi/api/.default",
      }),
      cache: "no-store",
    });
  } catch {
    throw new PowerBiError("Couldn't reach Microsoft. Try again.");
  }
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new PowerBiError(signInError(body.error_description ?? "", "Microsoft wouldn't sign the app in. Check the three values."));
  return body.access_token;
}

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new PowerBiError("Couldn't reach Power BI. Try again.");
  }
  if (res.ok) return (await res.json()) as T;
  const text = await res.text();
  if (res.status === 401 && /not accessible|API is not accessible for application/i.test(text)) {
    throw new PowerBiError("Power BI doesn't let apps use its API yet. A Power BI admin needs to turn on \"Service principals can call Fabric public APIs\" (step 4 below).");
  }
  if (res.status === 401 || res.status === 403) {
    throw new PowerBiError("The app can't open this workspace or dataset. Add it to the workspace as a Member (step 5 below).");
  }
  if (res.status === 404) throw new PowerBiError("Power BI couldn't find that workspace or dataset. It may have been moved or deleted.");
  if (res.status === 400 && /DatasetExecuteQueriesError|Query/i.test(text)) {
    const detail = /"message"\s*:\s*"([^"]+)"/.exec(text)?.[1];
    throw new PowerBiError(`Power BI couldn't run the revenue query${detail ? `: ${detail}` : "."}`);
  }
  throw new PowerBiError(`Power BI returned an error (${res.status}). Try again.`);
}

export type Workspace = { id: string; name: string };
export type Dataset = { id: string; name: string };

export async function listWorkspaces(token: string): Promise<Workspace[]> {
  const r = await call<{ value: Workspace[] }>(token, "/groups?$top=500");
  return r.value.map((g) => ({ id: g.id, name: g.name })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listDatasets(token: string, groupId: string): Promise<Dataset[]> {
  const r = await call<{ value: Dataset[] }>(token, `/groups/${groupId}/datasets`);
  return r.value.map((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name));
}

type Row = Record<string, unknown>;

export async function runQuery(token: string, groupId: string, datasetId: string, query: string): Promise<Row[]> {
  const r = await call<{ results: { tables?: { rows: Row[] }[]; error?: { message?: string } }[]; error?: { message?: string } }>(
    token,
    `/groups/${groupId}/datasets/${datasetId}/executeQueries`,
    { method: "POST", body: JSON.stringify({ queries: [{ query }], serializerSettings: { includeNulls: true } }) },
  );
  const first = r.results?.[0];
  const err = r.error?.message ?? first?.error?.message;
  if (err) throw new PowerBiError(`Power BI couldn't run the revenue query: ${err}`);
  return first?.tables?.[0]?.rows ?? [];
}

export type Field = { ref: string; label: string };

// Date columns and revenue choices (measures, then number columns) for the setup form.
export async function listFields(token: string, groupId: string, datasetId: string): Promise<{ dates: Field[]; amounts: Field[] }> {
  const pick = (row: Row, name: string) => {
    const k = Object.keys(row).find((key) => key.replace(/^.*\[|\]$/g, "").toLowerCase() === name.toLowerCase());
    return k ? row[k] : undefined;
  };
  const q = (t: string) => `'${String(t).replace(/'/g, "''")}'`;
  const c = (n: string) => `[${String(n).replace(/]/g, "]]")}]`;
  const [columns, measures] = await Promise.all([
    runQuery(token, groupId, datasetId, "EVALUATE INFO.VIEW.COLUMNS()"),
    runQuery(token, groupId, datasetId, "EVALUATE INFO.VIEW.MEASURES()"),
  ]);
  const dates: Field[] = [];
  const nums: Field[] = [];
  for (const row of columns) {
    const table = String(pick(row, "Table") ?? "");
    const name = String(pick(row, "Name") ?? "");
    const type = String(pick(row, "DataType") ?? "").toLowerCase();
    const hidden = String(pick(row, "IsHidden") ?? "").toLowerCase() === "true";
    if (!table || !name || hidden || /^(DateTableTemplate|LocalDateTable)_/.test(table)) continue;
    const ref = `${q(table)}${c(name)}`;
    if (type.includes("date")) dates.push({ ref, label: `${table} › ${name}` });
    else if (/int|decimal|double|currency|number/.test(type)) nums.push({ ref: `SUM(${ref})`, label: `Sum of ${table} › ${name}` });
  }
  const amounts: Field[] = measures
    .map((row) => ({ table: String(pick(row, "Table") ?? ""), name: String(pick(row, "Name") ?? "") }))
    .filter((m) => m.name)
    .map((m) => ({ ref: c(m.name), label: `${m.name} (measure${m.table ? ` in ${m.table}` : ""})` }));
  const byLabel = (a: Field, b: Field) => a.label.localeCompare(b.label);
  return { dates: dates.sort(byLabel), amounts: [...amounts.sort(byLabel), ...nums.sort(byLabel)] };
}

// Revenue by day for the years from fromYear on, one column per line ([S0], [S1], ...), as DAX.
// Days are added up into months afterwards, which is right for anything that adds up.
export function revenueQuery(dateColumn: string, series: RevenueSeries[], fromYear: number): string {
  return [
    "EVALUATE",
    "SUMMARIZECOLUMNS(",
    `  ${dateColumn},`,
    `  KEEPFILTERS(FILTER(ALL(${dateColumn}), NOT ISBLANK(${dateColumn}) && YEAR(${dateColumn}) >= ${fromYear})),`,
    series.map((x, i) => `  "S${i}", ${x.amount}`).join(",\n"),
    ")",
  ].join("\n");
}

export type MonthAmount = { year: number; month: number; amount: number };

// Adds the query's rows into months, one list per line. The date is the value that reads as a date.
export function rowsToMonths(rows: Row[], lines: number): MonthAmount[][] {
  const totals = Array.from({ length: lines }, () => new Map<string, MonthAmount>());
  for (const row of rows) {
    const keys = Object.keys(row);
    const dateKey = keys.find((k) => typeof row[k] === "string" && /^\d{4}-\d{2}-\d{2}/.test(row[k] as string));
    if (!dateKey) continue;
    const [, y, m] = /^(\d{4})-(\d{2})/.exec(row[dateKey] as string)!;
    for (let i = 0; i < lines; i++) {
      const key = keys.find((k) => k.toUpperCase().endsWith(`[S${i}]`));
      const amount = key == null ? NaN : Number(row[key] ?? NaN);
      if (row[key!] == null || !Number.isFinite(amount)) continue;
      const k = `${y}-${+m}`;
      const t = totals[i].get(k) ?? { year: +y, month: +m, amount: 0 };
      t.amount += amount;
      totals[i].set(k, t);
    }
  }
  return totals.map((t) => [...t.values()].map((x) => ({ ...x, amount: Math.round(x.amount) })).sort((a, b) => a.year - b.year || a.month - b.month));
}

// Every month from the first month with revenue through the given month, with zero for quiet months,
// so a month Power BI has nothing for shows $0 rather than falling back to another source.
export function fillMonths(months: MonthAmount[], through: { year: number; month: number }): MonthAmount[] {
  if (!months.length) return [];
  const map = new Map(months.map((m) => [`${m.year}-${m.month}`, m.amount]));
  const out: MonthAmount[] = [];
  let y = months[0].year;
  let m = 1;
  while (y < through.year || (y === through.year && m <= through.month)) {
    out.push({ year: y, month: m, amount: map.get(`${y}-${m}`) ?? 0 });
    if (++m > 12) (m = 1), y++;
  }
  return out;
}
