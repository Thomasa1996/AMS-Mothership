"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { firstError, formToObject, type FormState } from "@/lib/validation";

const roleIds = ROLES.map((r) => r.id) as [string, ...string[]];

const NewUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(roleIds),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only admins can manage users");
  return user;
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = NewUserSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { error: exists.active ? "Someone already uses that email" : "That person was removed from the team. Use Restore under Removed instead." };
  const { password, ...rest } = parsed.data;
  await db.user.create({
    data: { ...rest, passwordHash: await bcrypt.hash(password, 10), companyId: admin.companyId },
  });
  revalidatePath("/settings/users");
  return { ok: true };
}

export async function changeRole(userId: string, formData: FormData) {
  const admin = await requireAdmin();
  const role = z.enum(roleIds).parse(formData.get("role"));
  if (userId === admin.id && role !== "ADMIN") throw new Error("You can't remove your own admin role");
  await db.user.updateMany({ where: { id: userId, companyId: admin.companyId }, data: { role } });
  revalidatePath("/settings/users");
}

// Removing someone keeps their history (notes, quotes) but stops them signing in. Their accounts,
// projects they manage and their prospect lists go to the teammate the admin picks.
export async function removeUser(userId: string, handToId: string): Promise<FormState> {
  const admin = await requireAdmin();
  if (userId === admin.id) return { error: "You can't remove yourself" };
  const [person, handTo] = await Promise.all([
    db.user.findFirst({ where: { id: userId, companyId: admin.companyId, active: true } }),
    db.user.findFirst({ where: { id: handToId, companyId: admin.companyId, active: true } }),
  ]);
  if (!person) return { error: "That person isn't on the team" };
  if (!handTo || handTo.id === person.id) return { error: "Pick who takes over their companies" };
  await db.$transaction([
    db.account.updateMany({ where: { companyId: admin.companyId, ownerId: person.id }, data: { ownerId: handTo.id } }),
    db.project.updateMany({ where: { companyId: admin.companyId, managerId: person.id }, data: { managerId: handTo.id } }),
    db.prospectList.updateMany({ where: { companyId: admin.companyId, ownerId: person.id }, data: { ownerId: handTo.id } }),
    db.user.update({ where: { id: person.id }, data: { active: false } }),
  ]);
  revalidatePath("/settings/users");
  revalidatePath("/crm");
  return { ok: true };
}

export async function restoreUser(userId: string) {
  const admin = await requireAdmin();
  await db.user.updateMany({ where: { id: userId, companyId: admin.companyId }, data: { active: true } });
  revalidatePath("/settings/users");
}

// An admin sets a new password for a teammate, e.g. when they forget theirs.
export async function setPassword(userId: string, password: string): Promise<FormState> {
  const admin = await requireAdmin();
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  const res = await db.user.updateMany({
    where: { id: userId, companyId: admin.companyId },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  if (!res.count) return { error: "That person isn't on the team" };
  return { ok: true };
}
