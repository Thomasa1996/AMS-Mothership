"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readPdf } from "@/lib/pdf-upload";
import type { FormState } from "@/lib/validation";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only admins can change rate sheets");
  return user;
}

async function checkMarket(companyId: string, market: string) {
  if (market === "standard") return true;
  return !!(await db.branch.findFirst({ where: { id: market, companyId }, select: { id: true } }));
}

export async function uploadRateSheet(market: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!(await checkMarket(admin.companyId, market))) return { error: "Market not found" };
  const pdf = await readPdf(formData.get("file"));
  if ("error" in pdf) return pdf;
  const { data, fileName } = pdf;
  await db.rateSheet.upsert({
    where: { companyId_market: { companyId: admin.companyId, market } },
    create: { companyId: admin.companyId, market, fileName, data, size: data.length },
    update: { fileName, data, size: data.length, uploadedAt: new Date() },
  });
  revalidatePath("/sales/rates");
  return { ok: true };
}

export async function removeRateSheet(market: string) {
  const admin = await requireAdmin();
  await db.rateSheet.deleteMany({ where: { companyId: admin.companyId, market } });
  revalidatePath("/sales/rates");
}
