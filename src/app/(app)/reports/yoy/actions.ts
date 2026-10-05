"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MONTHS, isIgnoredLine, parseDollars } from "@/lib/revenue";
import { parsePastedRevenue, readRevenueFile, type LineMonth } from "@/lib/revenue-import";
import type { FormState } from "@/lib/validation";

export type SaveState = FormState & { message?: string };

const yearFrom = (v: FormDataEntryValue | null) => {
  const y = Number(v);
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : null;
};

async function store(companyId: string, rows: LineMonth[], source: string): Promise<SaveState> {
  const kept = rows.filter((r) => !isIgnoredLine(r.series));
  if (!kept.length) return { error: "No revenue lines found. Budget lines are skipped." };
  await db.$transaction(
    kept.map((r) =>
      db.revenueEntry.upsert({
        where: { companyId_series_year_month: { companyId, series: r.series, year: r.year, month: r.month } },
        create: { companyId, series: r.series, year: r.year, month: r.month, amount: r.amount, source },
        update: { amount: r.amount, source },
      }),
    ),
  );
  revalidatePath("/reports/yoy");
  const lines = [...new Set(kept.map((r) => r.series))];
  const years = [...new Set(kept.map((r) => r.year))].sort();
  return { ok: true, message: `Saved ${kept.length} months of ${lines.join(" and ")} for ${years.join(", ")}.` };
}

async function requireAdmin() {
  const user = await requireUser();
  return user.role === "ADMIN" ? user : null;
}

// A table copied from Power BI (Category, Month, Type, Sum of Amount) or Excel, pasted as text.
export async function pasteRevenue(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const user = await requireAdmin();
  if (!user) return { error: "Only admins can enter revenue" };
  const text = String(formData.get("text") ?? "");
  if (!text.trim()) return { error: "Paste the table first" };
  try {
    return await store(user.companyId, parsePastedRevenue(text, yearFrom(formData.get("year"))), "PASTE");
  } catch (e) {
    return { error: e instanceof Error ? `Couldn't read that table. ${e.message}` : "Couldn't read that table." };
  }
}

// A file exported from Power BI (Export data, as Excel or CSV).
export async function uploadRevenueFile(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const user = await requireAdmin();
  if (!user) return { error: "Only admins can upload revenue" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the exported file (.xlsx or .csv)" };
  if (file.size > 4 * 1024 * 1024) return { error: "That file is over 4 MB" };
  if (!/\.(xlsx|csv)$/i.test(file.name)) return { error: "Upload an .xlsx or .csv file. In Power BI, use Export data and pick Excel or CSV." };
  try {
    const rows = await readRevenueFile(file.name, Buffer.from(await file.arrayBuffer()), yearFrom(formData.get("year")));
    return await store(user.companyId, rows, "UPLOAD");
  } catch (e) {
    return { error: e instanceof Error ? `Couldn't read that file. ${e.message}` : "Couldn't read that file." };
  }
}

// Twelve months of one line for one year. A blank month is cleared (back to Power BI, or $0).
export async function saveRevenueMonths(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const user = await requireAdmin();
  if (!user) return { error: "Only admins can enter revenue" };
  const year = yearFrom(formData.get("year"));
  const series = String(formData.get("series") ?? "").trim();
  if (!year) return { error: "Pick a year" };
  if (!series) return { error: "Pick a revenue line" };
  const values: (number | null)[] = [];
  for (let m = 1; m <= 12; m++) {
    const v = parseDollars(String(formData.get(`m${m}`) ?? ""));
    if (Number.isNaN(v)) return { error: `${MONTHS[m - 1]} isn't a dollar amount` };
    values.push(v);
  }
  const companyId = user.companyId;
  await db.$transaction(
    values.map((amount, i) =>
      amount == null
        ? db.revenueEntry.deleteMany({ where: { companyId, series, year, month: i + 1 } })
        : db.revenueEntry.upsert({
            where: { companyId_series_year_month: { companyId, series, year, month: i + 1 } },
            create: { companyId, series, year, month: i + 1, amount, source: "TYPED" },
            update: { amount, source: "TYPED" },
          }),
    ),
  );
  revalidatePath("/reports/yoy");
  return { ok: true, message: "Saved" };
}
