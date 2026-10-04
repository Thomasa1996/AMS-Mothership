"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { firstError, formToObject, type FormState } from "@/lib/validation";
import { parseVendorWorkbook } from "@/lib/vendor-import";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const VendorSchema = z.object({
  category: z.string().trim().min(1, "Category is required"),
  name: z.string().trim().min(1, "Vendor name is required"),
  memberId: optionalText,
  state: optionalText,
  contactName: optionalText,
  phone: optionalText,
  email: optionalText,
  address: optionalText,
  website: optionalText,
  markets: optionalText,
  verificationStatus: optionalText,
  currentEmployer: optionalText,
  previousContact: optionalText,
  notes: optionalText,
});

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export async function createVendor(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = VendorSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const last = await db.vendor.aggregate({
    where: { companyId: user.companyId, category: parsed.data.category },
    _max: { position: true },
  });
  const vendor = await db.vendor.create({
    data: { ...parsed.data, position: (last._max.position ?? -1) + 1, companyId: user.companyId },
  });
  revalidatePath("/sales/vendors");
  redirect(`/sales/vendors/${vendor.id}`);
}

export async function updateVendor(vendorId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = VendorSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { count } = await db.vendor.updateMany({ where: { id: vendorId, companyId: user.companyId }, data: parsed.data });
  if (count === 0) return { error: "Vendor not found" };
  revalidatePath("/sales/vendors");
  return { ok: true };
}

export async function deleteVendor(vendorId: string) {
  const user = await requireUser();
  await db.vendor.deleteMany({ where: { id: vendorId, companyId: user.companyId } });
  revalidatePath("/sales/vendors");
  redirect("/sales/vendors");
}

export type ImportState = FormState & { imported?: number; categories?: number };

export async function importVendors(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can import vendors" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an Excel file (.xlsx)" };
  if (file.size > MAX_IMPORT_BYTES) return { error: "That file is over 10 MB" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "Only .xlsx files can be imported" };

  let rows;
  try {
    rows = await parseVendorWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: "Couldn't read that file. Save it as .xlsx and try again." };
  }
  if (rows.length === 0) return { error: "No vendor rows found. Each sheet needs a Company column." };

  const replace = formData.get("replace") === "on";
  await db.$transaction([
    ...(replace ? [db.vendor.deleteMany({ where: { companyId: user.companyId } })] : []),
    db.vendor.createMany({ data: rows.map((r) => ({ ...r, companyId: user.companyId })) }),
  ]);
  revalidatePath("/sales/vendors");
  return { ok: true, imported: rows.length, categories: new Set(rows.map((r) => r.category)).size };
}
