"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApolloError, enrichPerson, personToAccount, personToContact } from "@/lib/apollo";
import { apolloKeyFor } from "@/lib/apollo-company";
import { nameKey } from "@/lib/hubspot-sync";

export type AddState = { ok?: boolean; error?: string; accountId?: string; accountName?: string; mine?: boolean };

// Looks the person up in Apollo (1 credit) and adds them as a contact. They go under the account with
// their company's name, or a new account owned by whoever added them.
export async function addFromApollo(apolloId: string): Promise<AddState> {
  const user = await requireUser();
  if (!/^[a-zA-Z0-9]{8,40}$/.test(apolloId)) return { error: "That isn't an Apollo person" };
  const existing = await db.contact.findFirst({ where: { companyId: user.companyId, apolloId }, include: { account: true } });
  if (existing) return { ok: true, accountId: existing.accountId, accountName: existing.account.name, mine: existing.account.ownerId === user.id };

  const key = await apolloKeyFor(user.companyId);
  if (!key) return { error: "Apollo isn't connected. An admin can connect it in Settings, Apollo." };
  let person;
  try {
    person = await enrichPerson(key, apolloId);
  } catch (e) {
    return { error: e instanceof ApolloError ? e.message : "Couldn't reach Apollo. Try again." };
  }

  const accountData = personToAccount(person);
  const key2 = nameKey(accountData.name);
  const candidates = await db.account.findMany({
    where: { companyId: user.companyId },
    select: { id: true, name: true, ownerId: true },
    orderBy: { createdAt: "asc" },
  });
  const contact = personToContact(person);
  const result = await db.$transaction(async (tx) => {
    const account =
      candidates.find((a) => nameKey(a.name) === key2) ??
      (await tx.account.create({ data: { ...accountData, companyId: user.companyId, source: "APOLLO", ownerId: user.id }, select: { id: true, name: true, ownerId: true } }));
    const hasContacts = await tx.contact.count({ where: { accountId: account.id } });
    await tx.contact.create({ data: { ...contact, phone: null, accountId: account.id, companyId: user.companyId, apolloId, isPrimary: hasContacts === 0 } });
    await tx.activity.create({
      data: { companyId: user.companyId, accountId: account.id, userId: user.id, type: "NOTE", body: `${contact.name} added from Apollo${contact.title ? ` (${contact.title})` : ""}` },
    });
    return account;
  });
  revalidatePath("/sales/new-business");
  revalidatePath("/crm");
  return { ok: true, accountId: result.id, accountName: result.name, mine: result.ownerId === user.id };
}
