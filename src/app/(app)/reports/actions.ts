"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseEmbedUrl } from "@/lib/powerbi";
import { parseRepReportUrl } from "@/lib/rep-report";
import { firstError, formToObject, type FormState } from "@/lib/validation";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only admins can change reports");
  return user;
}

const ReportSchema = z.object({
  name: z.string().trim().min(1, "Give the report a name"),
  link: z.string().trim().min(1, "Paste the embed link from Power BI"),
});

export async function addReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = ReportSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const embedUrl = parseEmbedUrl(parsed.data.link);
  if (!embedUrl) {
    return { error: "That isn't a Power BI embed link. In Power BI use File, Embed report, Website or portal, and copy the first link." };
  }
  const last = await db.powerBiReport.aggregate({ where: { companyId: admin.companyId }, _max: { position: true } });
  await db.powerBiReport.create({
    data: { companyId: admin.companyId, name: parsed.data.name, embedUrl, position: (last._max.position ?? -1) + 1 },
  });
  revalidatePath("/reports");
  return { ok: true };
}

export async function removeReport(id: string) {
  const admin = await requireAdmin();
  await db.powerBiReport.deleteMany({ where: { id, companyId: admin.companyId } });
  revalidatePath("/reports");
}

// Saves (or clears, when blank) the SharePoint or Power BI link for one rep's own report.
export async function saveRepReport(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw = String(formData.get("link") ?? "").trim();
  const url = raw ? parseRepReportUrl(raw) : null;
  if (raw && !url) return { error: "Paste a SharePoint, OneDrive or Power BI link (it should start with https://)." };
  const res = await db.user.updateMany({ where: { id: userId, companyId: admin.companyId }, data: { repReportUrl: url } });
  if (!res.count) return { error: "That person isn't on the team" };
  revalidatePath("/reports/reps", "layout");
  return { ok: true };
}
