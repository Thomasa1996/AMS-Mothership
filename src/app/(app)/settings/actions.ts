"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseDollarsToCents } from "@/lib/quote-math";
import { firstError, formToObject, type FormState } from "@/lib/validation";

const MAX_IMAGE_CHARS = 700_000; // about 500 KB once base64 encoded

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only admins can change this");
  return user;
}

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const imageField = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || (v.startsWith("data:image/") && v.length <= MAX_IMAGE_CHARS), "Images must be PNG, JPG or SVG under 500 KB");

// Rate card

const RateSchema = z.object({
  category: z.string().trim().min(1, "Category is required"),
  name: z.string().trim().min(1, "Name is required"),
  unit: z.string().trim().min(1, "Unit is required"),
  rate: z.string().transform((v, ctx) => {
    const cents = parseDollarsToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter the rate in dollars" });
      return z.NEVER;
    }
    return cents;
  }),
  notes: optional,
  active: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export async function saveRate(rateId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = RateSchema.safeParse({ active: rateId ? undefined : "on", ...formToObject(formData) });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { rate, ...rest } = parsed.data;
  if (rateId) {
    const { count } = await db.rateItem.updateMany({
      where: { id: rateId, companyId: admin.companyId },
      data: { ...rest, rateCents: rate },
    });
    if (!count) return { error: "Rate not found" };
  } else {
    const last = await db.rateItem.aggregate({ where: { companyId: admin.companyId }, _max: { position: true } });
    await db.rateItem.create({
      data: { ...rest, rateCents: rate, companyId: admin.companyId, position: (last._max.position ?? -1) + 1 },
    });
  }
  revalidatePath("/settings/rates");
  revalidatePath("/sales/rates");
  return { ok: true };
}

export async function deleteRate(rateId: string) {
  const admin = await requireAdmin();
  await db.rateItem.deleteMany({ where: { id: rateId, companyId: admin.companyId } });
  revalidatePath("/settings/rates");
  revalidatePath("/sales/rates");
}

export async function saveRateNotes(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const notes = z.string().trim().parse(formData.get("rateCardNotes") ?? "");
  await db.company.update({ where: { id: admin.companyId }, data: { rateCardNotes: notes || null } });
  revalidatePath("/settings/rates");
  revalidatePath("/sales/rates");
  return { ok: true };
}

// Quote template

const TemplateSchema = z.object({
  displayName: optional,
  logo: imageField,
  quoteIntro: optional,
  quoteInvestmentHeading: optional,
  quoteValuation: optional,
  quoteOptionalValuation: optional,
  quoteCompanyDuties: optional,
  quoteClientDuties: optional,
});

export async function saveTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = TemplateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await db.company.update({ where: { id: admin.companyId }, data: parsed.data });
  revalidatePath("/settings/quote-template");
  revalidatePath("/sales/quotes");
  return { ok: true };
}

// Profile

const ProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  title: optional,
  signature: imageField,
});

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = ProfileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await db.user.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true };
}
