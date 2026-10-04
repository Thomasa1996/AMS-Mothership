import type { Prisma } from "@prisma/client";
import { limitedToOwn } from "./access";

type Viewer = { id: string; companyId: string; role: string };

// Salespeople see only their own prospect lists; everyone else sees the whole company's.
export function listScope(user: Viewer): Prisma.ProspectListWhereInput {
  return { companyId: user.companyId, ...(limitedToOwn(user) ? { ownerId: user.id } : {}) };
}
