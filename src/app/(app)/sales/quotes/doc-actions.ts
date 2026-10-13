"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readOfficeFile } from "@/lib/file-upload";
import { documentText } from "@/lib/doc-text";
import { findProposalTotal } from "@/lib/proposal-total";
import { parseDollarsToCents } from "@/lib/quote-math";
import type { FormState } from "@/lib/validation";

// One file per call, so each request stays under the upload size limit.
export async function addQuoteDoc(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = await readOfficeFile(formData.get("file"));
  if ("error" in file) return file;
  const totalCents = findProposalTotal(await documentText(file.fileName, file.data));
  await db.quoteDoc.create({
    data: { companyId: user.companyId, ownerId: user.id, fileName: file.fileName, contentType: file.contentType, size: file.data.length, data: file.data, totalCents },
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

// The proposal's total, read from the file or typed in; blank clears it. Same people as removing.
export async function setQuoteDocTotal(id: string, value: string): Promise<FormState> {
  const user = await requireUser();
  const cents = value.trim() ? parseDollarsToCents(value) : null;
  if (value.trim() && cents === null) return { error: "Enter dollars, like 12,500" };
  const { count } = await db.quoteDoc.updateMany({
    where: { id, companyId: user.companyId, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) },
    data: { totalCents: cents },
  });
  if (!count) return { error: "Quote not found" };
  revalidatePath("/sales/quotes");
  return { ok: true };
}
