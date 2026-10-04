"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { FormState } from "@/lib/validation";

// Vercel caps uploads at 4.5 MB, so keep a little under that.
const MAX_BYTES = 4 * 1024 * 1024;

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
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF to upload" };
  if (file.size > MAX_BYTES) return { error: "That PDF is over 4 MB. Try saving it smaller (File, Reduce size in most PDF apps)." };
  const data = Buffer.from(await file.arrayBuffer());
  if (data.subarray(0, 5).toString() !== "%PDF-") return { error: "That file isn't a PDF" };
  const fileName = file.name.toLowerCase().endsWith(".pdf") ? file.name : `${file.name}.pdf`;
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
