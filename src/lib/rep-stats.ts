import { db } from "./db";

const OPEN_STAGES = ["LEAD", "SURVEY", "QUOTED"];

export type RepStats = {
  accounts: number;
  openPipeline: number; // dollars
  openProjects: number;
  sentCount: number;
  sentCents: number;
  wonCount: number;
  wonCents: number;
  lostCount: number;
};

// Each rep's numbers for the year so far: their accounts and open pipeline, and quotes they wrote.
export async function repStats(companyId: string, userIds: string[], yearStart: Date): Promise<Map<string, RepStats>> {
  const [accounts, pipeline, sent, won, lost] = await Promise.all([
    db.account.groupBy({ by: ["ownerId"], where: { companyId, ownerId: { in: userIds } }, _count: true }),
    db.project.findMany({
      where: { companyId, stage: { in: OPEN_STAGES }, account: { ownerId: { in: userIds } } },
      select: { estimatedValue: true, account: { select: { ownerId: true } } },
    }),
    db.quote.groupBy({ by: ["createdById"], where: { companyId, createdById: { in: userIds }, sentAt: { gte: yearStart } }, _count: true, _sum: { totalCents: true } }),
    db.quote.groupBy({ by: ["createdById"], where: { companyId, createdById: { in: userIds }, status: "ACCEPTED", decidedAt: { gte: yearStart } }, _count: true, _sum: { totalCents: true } }),
    db.quote.groupBy({ by: ["createdById"], where: { companyId, createdById: { in: userIds }, status: "DECLINED", decidedAt: { gte: yearStart } }, _count: true }),
  ]);
  const out = new Map<string, RepStats>(
    userIds.map((id) => [id, { accounts: 0, openPipeline: 0, openProjects: 0, sentCount: 0, sentCents: 0, wonCount: 0, wonCents: 0, lostCount: 0 }]),
  );
  for (const a of accounts) if (a.ownerId) out.get(a.ownerId)!.accounts = a._count;
  for (const p of pipeline) {
    const s = out.get(p.account.ownerId!)!;
    s.openPipeline += p.estimatedValue ?? 0;
    s.openProjects++;
  }
  for (const q of sent) Object.assign(out.get(q.createdById!)!, { sentCount: q._count, sentCents: q._sum.totalCents ?? 0 });
  for (const q of won) Object.assign(out.get(q.createdById!)!, { wonCount: q._count, wonCents: q._sum.totalCents ?? 0 });
  for (const q of lost) out.get(q.createdById!)!.lostCount = q._count;
  return out;
}

export const winRate = (s: RepStats) => (s.wonCount + s.lostCount ? Math.round((100 * s.wonCount) / (s.wonCount + s.lostCount)) : null);
