"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MONTHS, parseDollars } from "@/lib/revenue";
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
            create: { companyId, year, month: i + 1, amount },
            update: { amount },
          }),
    ),
  );
  revalidatePath("/reports/yoy");
  return { ok: true };
}
