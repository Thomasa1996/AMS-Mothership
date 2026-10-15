"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { open, seal } from "@/lib/secret-box";
import { isGuid } from "@/lib/powerbi-api";
import { MailError, getMailToken } from "@/lib/mail-graph";
import { mailCreds, runMailProposalSync } from "@/lib/mail-proposals-run";
import type { FormState } from "@/lib/validation";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only admins can change this");
  return user;
}

function refresh() {
  revalidatePath("/settings/email");
  revalidatePath("/sales/quotes");
}

export async function connectMail(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  let secret = String(formData.get("secret") ?? "").trim();
  if (!isGuid(tenantId)) return { error: "The Directory (tenant) ID looks like 8c3f2a1e-…, 36 characters." };
  if (!isGuid(clientId)) return { error: "The Application (client) ID looks like 8c3f2a1e-…, 36 characters." };
  if (!secret) {
    // Keep the saved secret, or reuse Power BI's when it's the same app.
    const saved = await mailCreds(admin.companyId);
    const company = await db.company.findUniqueOrThrow({ where: { id: admin.companyId }, select: { powerbiClientId: true, powerbiSecret: true } });
    const powerbi = company.powerbiClientId === clientId && company.powerbiSecret ? open(company.powerbiSecret) : null;
    secret = saved?.secret ?? powerbi ?? "";
    if (!secret) return { error: "Paste the client secret's Value" };
  }
  try {
    await getMailToken({ tenantId, clientId, secret });
  } catch (e) {
    return { error: e instanceof MailError ? e.message : "Couldn't reach Microsoft. Try again." };
  }
  await db.company.update({ where: { id: admin.companyId }, data: { mailTenantId: tenantId, mailClientId: clientId, mailSecret: seal(secret) } });
  refresh();
  return { ok: true };
}

// Whose sent email to read, and from what date.
export async function saveMailPeople(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const since = String(formData.get("since") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) return { error: "Pick the date to start from" };
  const ids = formData.getAll("people").map(String);
  const company = await db.company.findUniqueOrThrow({ where: { id: admin.companyId }, select: { mailSince: true } });
  const sinceDate = new Date(`${since}T00:00:00Z`);
  await db.$transaction([
    db.user.updateMany({ where: { companyId: admin.companyId, id: { in: ids } }, data: { mailProposals: true } }),
    db.user.updateMany({ where: { companyId: admin.companyId, id: { notIn: ids } }, data: { mailProposals: false } }),
    // An earlier start date means looking through everyone's mail again; files already pulled are skipped.
    ...(company.mailSince && sinceDate < company.mailSince ? [db.user.updateMany({ where: { companyId: admin.companyId }, data: { mailCursor: null } })] : []),
    db.company.update({ where: { id: admin.companyId }, data: { mailSince: sinceDate } }),
  ]);
  refresh();
  return { ok: true };
}

export async function syncMailNow(_prev: FormState): Promise<FormState> {
  const admin = await requireAdmin();
  const result = await runMailProposalSync(admin.companyId);
  refresh();
  return result.ok ? { ok: true } : { error: result.message };
}

// Disconnecting keeps the proposals already pulled.
export async function disconnectMail() {
  const admin = await requireAdmin();
  await db.company.update({ where: { id: admin.companyId }, data: { mailTenantId: null, mailClientId: null, mailSecret: null, mailSyncResult: null, mailSyncedAt: null } });
  refresh();
}
