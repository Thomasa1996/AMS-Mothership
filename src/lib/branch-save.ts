import type { PrismaClient } from "@prisma/client";
import type { BranchRow } from "./branch-import";
import { MARKET_WAGES, marketFactors, marketNotes, marketRateCents } from "./market-rates";

// Saves imported branch profiles. Re-importing updates each branch's profile but keeps the
// capacity fields and market rates the team has edited since.
export async function saveBranches(db: PrismaClient, companyId: string, rows: BranchRow[]) {
  const rateItems = await db.rateItem.findMany({ where: { companyId } });
  let created = 0;
  for (const row of rows) {
    const profile = {
      position: row.position,
      profileDate: row.profileDate,
      approval: row.approval,
      warehouses: JSON.stringify(row.warehouses),
      contacts: JSON.stringify(row.contacts),
      profile: JSON.stringify(row.profile),
    };
    const existing = await db.branch.findUnique({ where: { companyId_name: { companyId, name: row.name } } });
    if (existing) {
      await db.branch.update({ where: { id: existing.id }, data: profile });
      continue;
    }
    const wage = MARKET_WAGES[row.name];
    const factors = wage ? marketFactors(wage) : { laborFactor: 1, storageFactor: 1 };
    await db.branch.create({
      data: {
        ...profile,
        companyId,
        name: row.name,
        ...factors,
        marketNotes: wage ? marketNotes(wage) : "No market wage data yet; using the standard rates.",
        rates: {
          create: rateItems.map((r) => ({ rateItemId: r.id, rateCents: marketRateCents(r.rateCents, r.category, factors) })),
        },
      },
    });
    created++;
  }
  return { created, updated: rows.length - created };
}
