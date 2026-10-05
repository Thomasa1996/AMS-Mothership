"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readOfficeFile } from "@/lib/file-upload";
import type { FormState } from "@/lib/validation";

// One file per call, so each request stays under the upload size limit.
export async function addQuoteDoc(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = await readOfficeFile(formData.get("file"));
  if ("error" in file) return file;
  await db.quoteDoc.create({
    data: { companyId: user.companyId, ownerId: user.id, fileName: file.fileName, contentType: file.contentType, size: file.data.length, data: file.data },
  });
  revalidatePath("/sales/quotes");
  return { ok: true };
}

// Reps remove their own files; admins can remove anyone's.
export async function deleteQuoteDoc(id: string) {
  const user = await requireUser();
  await db.quoteDoc.deleteMany({ where: { id, companyId: user.companyId, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) } });
  revalidatePath("/sales/quotes");
}
