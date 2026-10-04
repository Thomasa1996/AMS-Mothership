"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readPdf } from "@/lib/pdf-upload";
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
