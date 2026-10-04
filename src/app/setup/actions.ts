"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { RATE_CARD, RATE_CARD_NOTES } from "../../../prisma/rate-card";

// First-run setup on a new installation: creates the company, its standard rate card and the first
// admin. Only works while the database has no users, so it can't be used to take over a live site.

const SetupSchema = z.object({
  companyName: z.string().trim().min(1, "Enter your company name").max(200),
  name: z.string().trim().min(1, "Enter your name").max(200),
  title: z.string().trim().max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(10, "Use a password of at least 10 characters").max(200),
});

export type SetupState = { error?: string; ok?: boolean };

export async function setUpCompany(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const parsed = SetupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  if (formData.get("password") !== formData.get("confirm")) return { error: "The two passwords don't match" };
  const { companyName, name, title, email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.$transaction(async (tx) => {
    if (await tx.user.count()) return null;
    const company = await tx.company.create({
      data: { name: companyName, displayName: companyName, rateCardNotes: RATE_CARD_NOTES },
    });
    await tx.rateItem.createMany({
      data: RATE_CARD.map((r, i) => ({
        companyId: company.id,
        category: r.category,
        name: r.name,
        unit: r.unit,
        rateCents: Math.round(r.rate * 100),
        notes: r.notes ?? null,
        position: i,
      })),
    });
    return tx.user.create({
      data: { companyId: company.id, name, title: title || null, email, passwordHash, role: "ADMIN" },
    });
  });
  if (!user) return { error: "This site is already set up. Sign in instead." };
  await startSession(user);
  return { ok: true };
}
