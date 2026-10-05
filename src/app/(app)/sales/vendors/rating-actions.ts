"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { FormState } from "@/lib/validation";
import { RATING_CRITERIA, type Scores } from "@/lib/vendor-grade";

export async function rateVendor(vendorId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const vendor = await db.vendor.findFirst({ where: { id: vendorId, companyId: user.companyId }, select: { id: true } });
  if (!vendor) return { error: "Vendor not found" };
  const scores = {} as Scores;
  for (const c of RATING_CRITERIA) {
    const n = Number(formData.get(c.id));
    if (!Number.isInteger(n) || n < 1 || n > 5) return { error: `Give ${c.label.toLowerCase()} a score from 1 to 5` };
    scores[c.id] = n;
  }
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 2000) || null;
  await db.vendorRating.upsert({
    where: { vendorId_userId: { vendorId, userId: user.id } },
    create: { companyId: user.companyId, vendorId, userId: user.id, ...scores, comment },
    update: { ...scores, comment },
  });
  revalidatePath("/sales/vendors");
  revalidatePath(`/sales/vendors/${vendorId}`);
  return { ok: true };
}

// Anyone can remove their own rating; admins can remove anyone's.
export async function deleteVendorRating(ratingId: string) {
  const user = await requireUser();
  const rating = await db.vendorRating.findFirst({ where: { id: ratingId, companyId: user.companyId } });
  if (!rating || (rating.userId !== user.id && user.role !== "ADMIN")) return;
  await db.vendorRating.delete({ where: { id: rating.id } });
  revalidatePath("/sales/vendors");
  revalidatePath(`/sales/vendors/${rating.vendorId}`);
}
