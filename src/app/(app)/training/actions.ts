"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readPdf } from "@/lib/pdf-upload";
import { PICTURE_TYPES, toThumbnail } from "@/lib/thumbnail";
import type { FormState } from "@/lib/validation";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only admins can change training");
  return user;
}

// Links must be ordinary web addresses (YouTube, SharePoint, Loom and the like).
function cleanLink(v: string) {
  const t = v.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function addTraining(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const category = String(formData.get("category") ?? "").trim().slice(0, 80) || "General";
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000) || null;
  const linkText = String(formData.get("url") ?? "");
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!title) return { error: "Give it a title" };
  if (!hasFile && !linkText.trim()) return { error: "Choose a PDF or paste a link" };
  if (hasFile && linkText.trim()) return { error: "Add either a PDF or a link, not both" };

  if (hasFile) {
    const pdf = await readPdf(file);
    if ("error" in pdf) return { error: pdf.error };
    await db.trainingItem.create({
      data: { companyId: admin.companyId, title, category, description, fileName: pdf.fileName, size: pdf.data.byteLength, file: { create: { data: pdf.data } } },
    });
  } else {
    const url = cleanLink(linkText);
    if (!url) return { error: "That link doesn't look like a web address" };
    await db.trainingItem.create({ data: { companyId: admin.companyId, title, category, description, url } });
  }
  revalidatePath("/training");
  return { ok: true };
}

export async function deleteTraining(id: string) {
  const admin = await requireAdmin();
  await db.trainingItem.deleteMany({ where: { id, companyId: admin.companyId } });
  revalidatePath("/training");
}

async function pictureFrom(formData: FormData, field: string, keepTop: boolean) {
  const f = formData.get(field);
  if (!(f instanceof File) || f.size === 0 || f.size > 8 * 1024 * 1024) return null;
  return toThumbnail(new Uint8Array(await f.arrayBuffer()), keepTop);
}

// Saves the first page a browser drew for a PDF that has no picture yet.
export async function setTrainingThumbnail(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const thumbnail = await pictureFrom(formData, "thumbnail", true);
  if (thumbnail) await db.trainingItem.updateMany({ where: { id, companyId: admin.companyId, thumbnail: null }, data: { thumbnail } });
}

// A picture an admin picks for the card, in place of the PDF's first page or the video's still.
export async function setTrainingPicture(id: string, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const picture = formData.get("picture");
  if (!(picture instanceof File) || !PICTURE_TYPES.has(picture.type)) return { error: "Pick a PNG, JPEG, GIF or WebP picture" };
  if (picture.size > 4 * 1024 * 1024) return { error: "That picture is over 4 MB" };
  const thumbnail = await pictureFrom(formData, "picture", false);
  if (!thumbnail) return { error: "That picture couldn't be read" };
  const { count } = await db.trainingItem.updateMany({ where: { id, companyId: admin.companyId }, data: { thumbnail } });
  if (!count) return { error: "Training not found" };
  revalidatePath("/training");
  return { ok: true };
}
