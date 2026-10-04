"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HubSpotError, listOwners } from "@/lib/hubspot";
import { runHubSpotSync } from "@/lib/hubspot-run";
import { seal } from "@/lib/secret-box";
import type { FormState } from "@/lib/validation";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only admins can change this");
  return user;
}

export async function connectHubSpot(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const token = String(formData.get("token") ?? "").trim();
  if (!token) return { error: "Paste the access token from your HubSpot private app" };
  try {
    await listOwners(token); // checks the key works before saving it
  } catch (e) {
    return { error: e instanceof HubSpotError ? e.message : "Couldn't reach HubSpot. Try again." };
  }
  await db.company.update({ where: { id: admin.companyId }, data: { hubspotToken: seal(token) } });
  revalidatePath("/settings/hubspot");
  return { ok: true };
}

export async function syncHubSpotNow(_prev: FormState, _formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const result = await runHubSpotSync(admin.companyId, admin.id);
  revalidatePath("/settings/hubspot");
  revalidatePath("/crm");
  return result.ok ? { ok: true } : { error: result.message };
}

export async function disconnectHubSpot() {
  const admin = await requireAdmin();
  await db.company.update({ where: { id: admin.companyId }, data: { hubspotToken: null } });
  revalidatePath("/settings/hubspot");
}
