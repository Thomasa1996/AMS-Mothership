"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { listScope } from "@/lib/prospect-lists";

const Person = z.object({
  apolloId: z.string().regex(/^[a-zA-Z0-9]{8,40}$/),
  firstName: z.string().max(200).nullable(),
  lastName: z.string().max(200).nullable(),
  title: z.string().max(300).nullable(),
  companyName: z.string().max(300).nullable(),
});
const SaveInput = z.object({
  listId: z.string().optional(),
  newName: z.string().trim().max(120).optional(),
  people: z.array(Person).min(1, "Tick at least one person").max(100),
});

export type SaveListState = { ok?: boolean; error?: string; listId?: string; listName?: string; added?: number };

// Saves people from search results into one of the user's lists, or a new list. Uses no Apollo credits.
export async function saveToList(input: unknown): Promise<SaveListState> {
  const user = await requireUser();
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Couldn't save the list" };
  const { listId, newName, people } = parsed.data;

  let list: { id: string; name: string } | null;
  if (listId) {
    list = await db.prospectList.findFirst({ where: { id: listId, ...listScope(user) }, select: { id: true, name: true } });
    if (!list) return { error: "That list no longer exists" };
  } else {
    if (!newName) return { error: "Name the new list" };
    list = await db.prospectList.create({ data: { companyId: user.companyId, ownerId: user.id, name: newName }, select: { id: true, name: true } });
  }
  const res = await db.prospectListItem.createMany({ data: people.map((p) => ({ ...p, listId: list!.id })), skipDuplicates: true });
  await db.prospectList.update({ where: { id: list.id }, data: { updatedAt: new Date() } });
  revalidatePath("/sales/new-business", "layout");
  return { ok: true, listId: list.id, listName: list.name, added: res.count };
}

export async function removeFromList(itemId: string) {
  const user = await requireUser();
  const item = await db.prospectListItem.findFirst({ where: { id: itemId, list: listScope(user) } });
  if (!item) throw new Error("Not found");
  await db.prospectListItem.delete({ where: { id: itemId } });
  revalidatePath(`/sales/new-business/lists/${item.listId}`);
}

export async function renameList(listId: string, name: string) {
  const user = await requireUser();
  const clean = name.trim().slice(0, 120);
  if (!clean) return;
  const list = await db.prospectList.findFirst({ where: { id: listId, ...listScope(user) } });
  if (!list) throw new Error("Not found");
  await db.prospectList.update({ where: { id: listId }, data: { name: clean } });
  revalidatePath("/sales/new-business", "layout");
}

export async function deleteList(listId: string) {
  const user = await requireUser();
  const list = await db.prospectList.findFirst({ where: { id: listId, ...listScope(user) } });
  if (!list) throw new Error("Not found");
  await db.prospectList.delete({ where: { id: listId } });
  revalidatePath("/sales/new-business", "layout");
  redirect("/sales/new-business/lists");
}
