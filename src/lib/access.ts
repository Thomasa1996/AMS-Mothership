import type { Prisma } from "@prisma/client";

// Who can see what. Salespeople see only the accounts they own (and those accounts' projects)
// and only their quotes: ones they wrote, plus any quote on an account they own. Admins and the operations roles see the whole company.
// Accounts with no owner (and their contacts and projects) are hidden from everyone.

type Viewer = { id: string; companyId: string; role: string };

export function limitedToOwn(user: Viewer) {
  return user.role === "SALES";
}

export function accountScope(user: Viewer): Prisma.AccountWhereInput {
  return { companyId: user.companyId, ownerId: limitedToOwn(user) ? user.id : { not: null } };
}

export function projectScope(user: Viewer): Prisma.ProjectWhereInput {
  return { companyId: user.companyId, account: { ownerId: limitedToOwn(user) ? user.id : { not: null } } };
}

export function quoteScope(user: Viewer): Prisma.QuoteWhereInput {
  if (!limitedToOwn(user)) return { companyId: user.companyId };
  return { companyId: user.companyId, OR: [{ createdById: user.id }, { project: { account: { ownerId: user.id } } }] };
}

// People a user may pick as an account owner: the whole team for admins, just themselves for salespeople.
export function ownerChoices(user: Viewer): Prisma.UserWhereInput {
  return { companyId: user.companyId, active: true, ...(limitedToOwn(user) ? { id: user.id } : {}) };
}
