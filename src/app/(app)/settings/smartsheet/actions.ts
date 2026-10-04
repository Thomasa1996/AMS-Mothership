"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getMe, SMARTSHEET_REGIONS, SmartsheetError } from "@/lib/smartsheet";
import { seal } from "@/lib/secret-box";
import type { FormState } from "@/lib/validation";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only admins can change this");
  return user;
}

export async function connectSmartsheet(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const token = String(formData.get("token") ?? "").trim();
  const region = String(formData.get("region") ?? "us");
  if (!SMARTSHEET_REGIONS.some((r) => r.id === region)) return { error: "Pick which Smartsheet you use" };
  if (!token) return { error: "Paste the API access token from Smartsheet" };
  try {
    await getMe(token, region); // checks the token works before saving it
  } catch (e) {
    return { error: e instanceof SmartsheetError ? e.message : "Couldn't reach Smartsheet. Try again." };
  }
  await db.company.update({ where: { id: admin.companyId }, data: { smartsheetToken: seal(token), smartsheetRegion: region } });
  revalidatePath("/settings/smartsheet");
  revalidatePath("/sales/project-management");
  return { ok: true };
}

export async function saveSheetChoice(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const ids = formData.getAll("sheet").map(String).filter((id) => /^\d+$/.test(id));
  const all = formData.get("all") === "on";
  await db.company.update({
    where: { id: admin.companyId },
    data: { smartsheetSheetIds: all || ids.length === 0 ? null : JSON.stringify(ids) },
  });
  revalidatePath("/settings/smartsheet");
  revalidatePath("/sales/project-management");
  return { ok: true };
}

export async function disconnectSmartsheet() {
  const admin = await requireAdmin();
  await db.company.update({ where: { id: admin.companyId }, data: { smartsheetToken: null, smartsheetSheetIds: null } });
  revalidatePath("/settings/smartsheet");
  revalidatePath("/sales/project-management");
}
