"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApolloError, checkKey } from "@/lib/apollo";
import { seal } from "@/lib/secret-box";
import type { FormState } from "@/lib/validation";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only admins can change this");
  return user;
}

export async function connectApollo(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const key = String(formData.get("key") ?? "").trim();
  if (!key) return { error: "Paste the API key from Apollo" };
  try {
    await checkKey(key); // checks the key works and can search people before saving it
  } catch (e) {
    return { error: e instanceof ApolloError ? e.message : "Couldn't reach Apollo. Try again." };
  }
  await db.company.update({ where: { id: admin.companyId }, data: { apolloKey: seal(key) } });
  revalidatePath("/settings/apollo");
  revalidatePath("/sales/new-business");
  return { ok: true };
}

export async function disconnectApollo() {
  const admin = await requireAdmin();
  await db.company.update({ where: { id: admin.companyId }, data: { apolloKey: null } });
  revalidatePath("/settings/apollo");
  revalidatePath("/sales/new-business");
}
