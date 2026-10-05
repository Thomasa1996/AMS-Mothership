"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readOfficeFile } from "@/lib/file-upload";
import type { FormState } from "@/lib/validation";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only admins can change quote templates");
  return user;
}

export async function addQuoteTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const file = await readOfficeFile(formData.get("file"));
  if ("error" in file) return file;
  const name = String(formData.get("name") ?? "").trim() || file.fileName.replace(/\.[^.]+$/, "");
  const description = String(formData.get("description") ?? "").trim() || null;
  await db.quoteTemplate.create({
    data: { companyId: admin.companyId, name, description, fileName: file.fileName, contentType: file.contentType, size: file.data.length, data: file.data },
  });
  revalidatePath("/sales/quote-templates");
  return { ok: true };
}

export async function deleteQuoteTemplate(id: string) {
  const admin = await requireAdmin();
  await db.quoteTemplate.deleteMany({ where: { id, companyId: admin.companyId } });
  revalidatePath("/sales/quote-templates");
}
