"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseBranchWorkbook } from "@/lib/branch-import";
import { saveBranches } from "@/lib/branch-save";
import { marketRateCents } from "@/lib/market-rates";
import { parseDollarsToCents } from "@/lib/quote-math";
import type { FormState } from "@/lib/validation";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
// Roles that run the warehouses and can update a branch's capacity notes.
const CAPACITY_ROLES = ["ADMIN", "PROJECT_MANAGER", "WAREHOUSE"];

async function getBranchOrThrow(id: string, companyId: string) {
  const branch = await db.branch.findFirst({ where: { id, companyId } });
  if (!branch) throw new Error("Branch not found");
  return branch;
}

export type BranchImportState = FormState & { imported?: number; created?: number };

export async function importBranches(_prev: BranchImportState, formData: FormData): Promise<BranchImportState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can import branch profiles" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an Excel file (.xlsx)" };
  if (file.size > MAX_IMPORT_BYTES) return { error: "That file is over 10 MB" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "Only .xlsx files can be imported" };

  let rows;
  try {
    rows = await parseBranchWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: "Couldn't read that file. Save it as .xlsx and try again." };
  }
  if (rows.length === 0) return { error: "No branch profiles found. Each branch sheet starts with \"Apple Moving Warehouse Profile\"." };
  const { created } = await saveBranches(db, user.companyId, rows);
  revalidatePath("/sales/warehouses");
  return { ok: true, imported: rows.length, created };
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const CapacitySchema = z.object({
  warehouseSpace: optional(200),
  scale: optional(200),
  warehouseNotes: optional(5000),
  warehouseGrade: z
    .string()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 5), "Grade must be 1 to 5"),
});

export async function updateBranchCapacity(branchId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!CAPACITY_ROLES.includes(user.role)) return { error: "Only admins, project managers and warehouse staff can change this" };
  const parsed = CapacitySchema.safeParse({
    warehouseSpace: formData.get("warehouseSpace") ?? "",
    scale: formData.get("scale") ?? "",
    warehouseNotes: formData.get("warehouseNotes") ?? "",
    warehouseGrade: formData.get("warehouseGrade") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  try {
    await getBranchOrThrow(branchId, user.companyId);
    await db.branch.update({ where: { id: branchId }, data: parsed.data });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't save" };
  }
  revalidatePath("/sales/warehouses");
  return { ok: true };
}

// Saves an admin's edits to one market's prices. Inputs are named rate_<rateItemId>.
export async function saveMarketRates(branchId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can change market rates" };
  try {
    await getBranchOrThrow(branchId, user.companyId);
    const items = await db.rateItem.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true } });
    const updates: { rateItemId: string; rateCents: number }[] = [];
    for (const item of items) {
      const raw = formData.get(`rate_${item.id}`);
      if (typeof raw !== "string") continue;
      const cents = parseDollarsToCents(raw);
      if (cents === null) return { error: `Enter a valid price for ${item.name}` };
      updates.push({ rateItemId: item.id, rateCents: cents });
    }
    await db.$transaction(
      updates.map((u) =>
        db.branchRate.upsert({
          where: { branchId_rateItemId: { branchId, rateItemId: u.rateItemId } },
          create: { branchId, ...u },
          update: { rateCents: u.rateCents },
        }),
      ),
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't save" };
  }
  revalidatePath("/sales/warehouses");
  revalidatePath("/sales/rates");
  return { ok: true };
}

const percent = z.coerce.number().min(-60, "Use a percentage between -60 and 100").max(100, "Use a percentage between -60 and 100");

// Sets a market's labor and storage adjustment and reprices every rate from the standard card.
export async function repriceMarket(branchId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can change market rates" };
  const labor = percent.safeParse(formData.get("labor"));
  const storage = percent.safeParse(formData.get("storage"));
  if (!labor.success) return { error: labor.error.issues[0]!.message };
  if (!storage.success) return { error: storage.error.issues[0]!.message };
  const factors = { laborFactor: 1 + labor.data / 100, storageFactor: 1 + storage.data / 100 };
  try {
    await getBranchOrThrow(branchId, user.companyId);
    const items = await db.rateItem.findMany({ where: { companyId: user.companyId } });
    await db.$transaction([
      // Touching the branch also refreshes the rate editor so it shows the new prices.
      db.branch.update({ where: { id: branchId }, data: factors }),
      ...items.map((r) => {
        const rateCents = marketRateCents(r.rateCents, r.category, factors);
        return db.branchRate.upsert({
          where: { branchId_rateItemId: { branchId, rateItemId: r.id } },
          create: { branchId, rateItemId: r.id, rateCents },
          update: { rateCents },
        });
      }),
    ]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't save" };
  }
  revalidatePath("/sales/warehouses");
  revalidatePath("/sales/rates");
  return { ok: true };
}
