"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { seal } from "@/lib/secret-box";
import { PowerBiError, getToken, isGuid, listWorkspaces, type RevenueSource } from "@/lib/powerbi-api";
import { powerBiCreds, runPowerBiRevenueSync } from "@/lib/powerbi-revenue-run";
import type { FormState } from "@/lib/validation";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only admins can change this");
  return user;
}

function refresh() {
  revalidatePath("/settings/powerbi");
  revalidatePath("/reports/yoy");
}

export async function connectPowerBi(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  let secret = String(formData.get("secret") ?? "").trim();
  if (!isGuid(tenantId)) return { error: "The Directory (tenant) ID looks like 8c3f2a1e-…, 36 characters." };
  if (!isGuid(clientId)) return { error: "The Application (client) ID looks like 8c3f2a1e-…, 36 characters." };
  if (!secret) {
    // Keep the saved secret when only the IDs change.
    const saved = await powerBiCreds(admin.companyId);
    if (!saved) return { error: "Paste the client secret's Value" };
    secret = saved.secret;
  }
  try {
    await listWorkspaces(await getToken({ tenantId, clientId, secret }));
  } catch (e) {
    return { error: e instanceof PowerBiError ? e.message : "Couldn't reach Power BI. Try again." };
  }
  await db.company.update({
    where: { id: admin.companyId },
    data: { powerbiTenantId: tenantId, powerbiClientId: clientId, powerbiSecret: seal(secret) },
  });
  refresh();
  return { ok: true };
}

export async function saveRevenueSource(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const series = [0, 1, 2, 3, 4]
    .map((i) => ({ name: get(`name${i}`), amount: get(`amount${i}`) }))
    .filter((x) => x.name || x.amount);
  const source: RevenueSource = { groupId: get("groupId"), datasetId: get("datasetId"), dateColumn: get("dateColumn"), series };
  if (!isGuid(source.groupId) || !isGuid(source.datasetId)) return { error: "Pick the workspace and dataset first" };
  if (!source.dateColumn) return { error: "Pick the date to group by month" };
  if (!series.length) return { error: "Add at least one revenue line" };
  const half = series.find((x) => !x.name || !x.amount);
  if (half) return { error: half.name ? `Pick the measure for ${half.name}` : "Give each revenue line a name" };
  if (new Set(series.map((x) => x.name.toLowerCase())).size !== series.length) return { error: "Give each revenue line its own name" };
  await db.company.update({ where: { id: admin.companyId }, data: { powerbiRevenue: JSON.stringify(source) } });
  const result = await runPowerBiRevenueSync(admin.companyId);
  refresh();
  return result.ok ? { ok: true } : { error: result.message };
}

export async function syncPowerBiNow(_prev: FormState): Promise<FormState> {
  const admin = await requireAdmin();
  const result = await runPowerBiRevenueSync(admin.companyId);
  refresh();
  return result.ok ? { ok: true } : { error: result.message };
}

// Disconnecting keeps the months already read; they stay on Year over year until replaced.
export async function disconnectPowerBi() {
  const admin = await requireAdmin();
  await db.company.update({
    where: { id: admin.companyId },
    data: { powerbiTenantId: null, powerbiClientId: null, powerbiSecret: null, powerbiRevenue: null, powerbiSyncResult: null, powerbiSyncedAt: null },
  });
  refresh();
}

