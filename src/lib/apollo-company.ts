import { db } from "./db";
import { open } from "./secret-box";

// The company's Apollo API key, or null when none is saved (or it can't be read).
export async function apolloKeyFor(companyId: string) {
  const c = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { apolloKey: true } });
  return c.apolloKey ? open(c.apolloKey) : null;
}
