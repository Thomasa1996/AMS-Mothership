"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HubSpotError, listOwners } from "@/lib/hubspot";
import { runHubSpotSync } from "@/lib/hubspot-run";
import { seal } from "@/lib/secret-box";
import { sendQuotesToHubSpot } from "@/lib/hubspot-quotes";
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

// Switches sending quote files to HubSpot on or off, and sends what's waiting when it's switched on.
export async function setHubSpotQuotes(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const on = formData.get("on") === "1";
  await db.company.update({ where: { id: admin.companyId }, data: { hubspotQuotes: on } });
  revalidatePath("/settings/hubspot");
  revalidatePath("/sales/quotes");
  return on ? sendWaitingQuotes(admin.companyId) : { ok: true };
}

// Tries files that failed again, then sends everything waiting (as much as fits in one go).
export async function sendQuotesNow(_prev: FormState, _formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  await db.quoteDoc.updateMany({ where: { companyId: admin.companyId, hubspotSentAt: null, hubspotError: { not: null } }, data: { hubspotError: null } });
  return sendWaitingQuotes(admin.companyId);
}

async function sendWaitingQuotes(companyId: string): Promise<FormState> {
  const result = await sendQuotesToHubSpot(companyId, 45_000);
  revalidatePath("/settings/hubspot");
  revalidatePath("/sales/quotes");
  if (result.error) return { error: result.error };
  return { ok: true };
}
