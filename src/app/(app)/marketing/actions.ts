"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readOfficeFile } from "@/lib/file-upload";
import { makeThumbnail, toThumbnail } from "@/lib/thumbnail";
import type { FormState } from "@/lib/validation";

export async function addMarketingFile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can add marketing files" };
  const file = await readOfficeFile(formData.get("file"));
  if ("error" in file) return file;
  // PDFs and videos come with a preview drawn in the browser; the rest are made here.
  const drawn = formData.get("thumbnail");
  const thumbnail =
    drawn instanceof File && drawn.size > 0 && drawn.size < 2 * 1024 * 1024
      ? await toThumbnail(new Uint8Array(await drawn.arrayBuffer()))
      : await makeThumbnail(file.fileName, file.contentType, file.data);
  await db.marketingFile.create({
    data: {
      companyId: user.companyId,
      uploadedById: user.id,
      fileName: file.fileName,
      contentType: file.contentType,
      size: file.data.length,
      data: file.data,
      thumbnail,
    },
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

// Saves a preview drawn in an admin's browser for a PDF or video added before previews existed.
export async function setMarketingThumbnail(id: string, formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") return;
  const drawn = formData.get("thumbnail");
  if (!(drawn instanceof File) || drawn.size === 0 || drawn.size > 2 * 1024 * 1024) return;
  const thumbnail = await toThumbnail(new Uint8Array(await drawn.arrayBuffer()));
  if (thumbnail) await db.marketingFile.updateMany({ where: { id, companyId: user.companyId, thumbnail: null }, data: { thumbnail } });
}
