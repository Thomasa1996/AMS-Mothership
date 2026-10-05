"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MONTHS, parseDollars } from "@/lib/revenue";
import { readRevenueFile } from "@/lib/revenue-import";
import type { FormState } from "@/lib/validation";

// Saves the monthly totals an admin typed for one year. A blank month goes back to using won projects.
export async function saveRevenueMonths(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can enter revenue" };
  const year = Number(formData.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { error: "Pick a year" };
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
        ? db.revenueMonth.deleteMany({ where: { companyId, year, month: i + 1 } })
        : db.revenueMonth.upsert({
            where: { companyId_year_month: { companyId, year, month: i + 1 } },
            create: { companyId, year, month: i + 1, amount, source: "TYPED" },
            update: { amount, source: "TYPED" },
          }),
    ),
  );
  revalidatePath("/reports/yoy");
  return { ok: true };
}

export type UploadState = FormState & { message?: string };

// Reads monthly totals from a file exported from Power BI (or any sheet with dates and amounts).
export async function uploadRevenueFile(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can upload revenue" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the exported file (.xlsx or .csv)" };
  if (file.size > 4 * 1024 * 1024) return { error: "That file is over 4 MB" };
  if (!/\.(xlsx|csv)$/i.test(file.name)) return { error: "Upload an .xlsx or .csv file. In Power BI, use Export data and pick Excel or CSV." };
  let months;
  try {
    months = await readRevenueFile(file.name, Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return { error: e instanceof Error ? `Couldn't read that file. ${e.message}` : "Couldn't read that file." };
  }
  const companyId = user.companyId;
  await db.$transaction(
    months.map((m) =>
      db.revenueMonth.upsert({
        where: { companyId_year_month: { companyId, year: m.year, month: m.month } },
        create: { companyId, year: m.year, month: m.month, amount: m.amount, source: "UPLOAD" },
        update: { amount: m.amount, source: "UPLOAD" },
      }),
    ),
  );
  revalidatePath("/reports/yoy");
  const first = months[0];
  const last = months[months.length - 1];
  return { ok: true, message: `Loaded ${months.length} months, ${MONTHS[first.month - 1]} ${first.year} to ${MONTHS[last.month - 1]} ${last.year}.` };
}
