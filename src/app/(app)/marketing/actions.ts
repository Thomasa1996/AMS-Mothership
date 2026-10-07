"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readOfficeFile } from "@/lib/file-upload";
import type { FormState } from "@/lib/validation";

export async function addMarketingFile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can add marketing files" };
  const file = await readOfficeFile(formData.get("file"));
  if ("error" in file) return file;
  await db.marketingFile.create({
    data: { companyId: user.companyId, uploadedById: user.id, fileName: file.fileName, contentType: file.contentType, size: file.data.length, data: file.data },
  });
  revalidatePath("/marketing");
  return { ok: true };
}

export async function deleteMarketingFile(id: string) {
  const user = await requireUser();
  if (user.role !== "ADMIN") return;
  await db.marketingFile.deleteMany({ where: { id, companyId: user.companyId } });
  revalidatePath("/marketing");
}
