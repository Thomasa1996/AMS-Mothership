import type { PrismaClient } from "@prisma/client";
import type { StageId } from "./constants";
import { nameKey } from "./hubspot-sync";
import { cellText, getSheet, type Sheet, type SheetRow } from "./smartsheet";
import { IMPORT_FIELDS, type ImportConfig, type ImportField } from "./smartsheet-fields";

export { IMPORT_FIELDS, type ImportConfig, type ImportField };

// Turns the rows of one Smartsheet project sheet into CRM projects, one project per row. Each row's
// company becomes (or matches) a CRM account. Smartsheet is the source: mapped fields are copied over
// on every run, and nothing is ever written back to Smartsheet. Rows deleted in Smartsheet leave
// their project in place.

export function parseImportConfig(raw: string | null): ImportConfig | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw);
    return c && typeof c.sheetId === "string" && c.columns && typeof c.columns === "object" ? c : null;
  } catch {
    return null;
  }
}

const simple = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Picks the column most likely meant for each field, for a first look at the mapping form.
export function guessColumns(columns: { id: string; title: string }[]): Partial<Record<ImportField, string>> {
  const out: Partial<Record<ImportField, string>> = {};
  const used = new Set<string>();
  for (const f of IMPORT_FIELDS) {
    for (const g of f.guess) {
      const hit = columns.find((c) => !used.has(c.id) && simple(c.title) === g);
      if (hit) {
        out[f.id] = hit.id;
        used.add(hit.id);
        break;
      }
    }
  }
  return out;
}

// Smartsheet statuses vary by sheet, so match on common words. Anything else counts as booked,
// since a job on the project sheet is usually sold.
export function stageFromText(text: string): StageId {
  const t = simple(text);
  if (!t) return "BOOKED";
  if (/\b(cancel|cancelled|canceled|lost|dead|declined)\b/.test(t)) return "LOST";
  if (/\b(complete|completed|done|closed|finished|invoiced|paid)\b/.test(t)) return "COMPLETED";
  if (/\b(in progress|active|underway|started|working|ongoing)\b/.test(t)) return "IN_PROGRESS";
  if (/\b(quote|quoted|proposal|bid|pending)\b/.test(t)) return "QUOTED";
  if (/\b(survey|walkthrough|site visit)\b/.test(t)) return "SURVEY";
  if (/\b(lead|prospect)\b/.test(t)) return "LEAD";
  return "BOOKED";
}

// "$12,500.00" or 12500 -> 12500 (whole dollars). Blank or unreadable -> null.
export function dollarsFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const m = String(value ?? "").replace(/[$,\s]/g, "").match(/^-?\d+(\.\d+)?$/);
  return m ? Math.round(Number(m[0])) : null;
}

// Smartsheet dates come as "2026-10-05"; text columns may hold "10/5/2026".
export function dateFrom(value: unknown): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3], 12));
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) return new Date(Date.UTC(us[3].length === 2 ? 2000 + +us[3] : +us[3], +us[1] - 1, +us[2], 12));
  return null;
}

type Person = { id: string; name: string; email: string };

// Contact-list columns hold an email (value) and a name (displayValue); text columns hold either.
export function findPerson(people: Person[], cell: { value?: unknown; displayValue?: string } | undefined): Person | null {
  if (!cell) return null;
  const texts = [cell.value, cell.displayValue].filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim().toLowerCase());
  for (const t of texts) {
    const p = people.find((x) => x.email.toLowerCase() === t || x.name.toLowerCase() === t);
    if (p) return p;
  }
  return null;
}

export type ImportResult = { created: number; updated: number; accountsCreated: number; skipped: number; unmatchedReps: string[] };

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function describeImport(r: ImportResult) {
  const parts = [count(r.created, "new project", "new projects"), `${r.updated} updated`];
  if (r.accountsCreated) parts.push(count(r.accountsCreated, "new account", "new accounts"));
  if (r.skipped) parts.push(`${count(r.skipped, "row", "rows")} skipped for having no project name or client`);
  let text = parts.join(", ") + ".";
  if (r.unmatchedReps.length) {
    text += ` No Mothership login matches ${r.unmatchedReps.slice(0, 5).join(", ")}${r.unmatchedReps.length > 5 ? " and others" : ""}, so their new accounts went to the admin who ran the import.`;
  }
  return text;
}

export async function importProjects(db: PrismaClient, companyId: string, conn: { token: string; region: string }, config: ImportConfig, actorId: string): Promise<ImportResult> {
  const sheet: Sheet = await getSheet(conn.token, conn.region, config.sheetId);
  const col = (f: ImportField) => {
    const id = config.columns[f];
    return id ? sheet.columns.find((c) => String(c.id) === id) ?? null : null;
  };
  const cellOf = (row: SheetRow, f: ImportField) => {
    const c = col(f);
    return c ? row.cells.find((x) => x.columnId === c.id) : undefined;
  };
  const text = (row: SheetRow, f: ImportField) => {
    const c = col(f);
    return c ? cellText(cellOf(row, f), c.type).trim() : "";
  };

  const people = await db.user.findMany({ where: { companyId, active: true }, select: { id: true, name: true, email: true } });
  const accounts = new Map<string, string>();
  for (const a of await db.account.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } })) {
    if (!accounts.has(nameKey(a.name))) accounts.set(nameKey(a.name), a.id);
  }
  const existing = new Map(
    (
      await db.project.findMany({
        where: { companyId, smartsheetRowId: { not: null } },
        select: { id: true, smartsheetRowId: true, name: true, accountId: true, stage: true, moveDate: true, estimatedValue: true, originAddress: true, destinationAddress: true, managerId: true },
      })
    ).map((p) => [p.smartsheetRowId!, p]),
  );

  const result: ImportResult = { created: 0, updated: 0, accountsCreated: 0, skipped: 0, unmatchedReps: [] };
  const unmatched = new Set<string>();
  for (const row of sheet.rows) {
    const name = text(row, "name");
    const company = text(row, "company").replace(/\s+/g, " ");
    if (!name || !company) {
      // Blank rows and section headings in the sheet.
      if (name || company) result.skipped++;
      continue;
    }
    let accountId = accounts.get(nameKey(company));
    if (!accountId) {
      // A new account goes to the row's sales rep, or to whoever runs the import when no login matches.
      const ownerText = text(row, "owner");
      const owner = findPerson(people, cellOf(row, "owner"));
      if (ownerText && !owner) unmatched.add(ownerText);
      accountId = (await db.account.create({ data: { companyId, name: company, source: "SMARTSHEET", ownerId: owner?.id ?? actorId }, select: { id: true } })).id;
      accounts.set(nameKey(company), accountId);
      result.accountsCreated++;
    }

    const data = {
      name,
      accountId,
      ...(col("stage") ? { stage: stageFromText(text(row, "stage")) } : {}),
      ...(col("moveDate") ? { moveDate: dateFrom(cellOf(row, "moveDate")?.value ?? text(row, "moveDate")) } : {}),
      ...(col("value") ? { estimatedValue: dollarsFrom(cellOf(row, "value")?.value ?? text(row, "value")) } : {}),
      ...(col("origin") ? { originAddress: text(row, "origin") || null } : {}),
      ...(col("destination") ? { destinationAddress: text(row, "destination") || null } : {}),
      ...(col("manager") ? { managerId: findPerson(people, cellOf(row, "manager"))?.id ?? null } : {}),
    };
    const current = existing.get(String(row.id));
    if (current) {
      const same = (Object.keys(data) as (keyof typeof data)[]).every((k) => {
        const a = current[k as keyof typeof current];
        const b = data[k];
        return a instanceof Date || b instanceof Date ? (a as Date | null)?.getTime() === (b as Date | null)?.getTime() : a === b;
      });
      if (!same) {
        await db.project.update({ where: { id: current.id }, data });
        result.updated++;
      }
    } else {
      const p = await db.project.create({ data: { ...data, stage: data.stage ?? "BOOKED", companyId, smartsheetRowId: String(row.id) }, select: { id: true } });
      await db.activity.create({ data: { companyId, accountId, projectId: p.id, userId: actorId, type: "NOTE", body: `Added from Smartsheet (${sheet.name})` } });
      result.created++;
    }
  }
  result.unmatchedReps = [...unmatched].sort();
  return result;
}
