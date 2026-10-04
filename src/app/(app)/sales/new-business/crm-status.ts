import { db } from "@/lib/db";
import { accountScope, limitedToOwn } from "@/lib/access";

type Viewer = { id: string; companyId: string; role: string };

// Which of these Apollo people are already contacts, and whether this user can open their account.
export async function crmStatus(user: Viewer, apolloIds: string[]) {
  if (!apolloIds.length) return new Map<string, { id: string; name: string; canOpen: boolean; email: string | null; contactName: string }>();
  const contacts = await db.contact.findMany({
    where: { companyId: user.companyId, apolloId: { in: apolloIds } },
    select: { apolloId: true, name: true, email: true, account: { select: { id: true, name: true } } },
  });
  const visible = limitedToOwn(user)
    ? new Set((await db.account.findMany({ where: { ...accountScope(user), id: { in: contacts.map((c) => c.account.id) } }, select: { id: true } })).map((a) => a.id))
    : null;
  return new Map(
    contacts.map((c) => [
      c.apolloId!,
      { id: c.account.id, name: c.account.name, canOpen: !visible || visible.has(c.account.id), email: c.email, contactName: c.name },
    ]),
  );
}
