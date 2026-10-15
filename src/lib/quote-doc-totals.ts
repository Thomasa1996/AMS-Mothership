import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { documentDate, documentText } from "./doc-text";
import { findProposalTotal } from "./proposal-total";
import { findMarket } from "./proposal-market";
import { findAccount } from "./proposal-account";

// The company's markets, for finding which one a proposal is for.
export const companyMarkets = (companyId: string) => db.branch.findMany({ where: { companyId }, select: { id: true, name: true, warehouses: true } });

// The market a file names most: in its file name, its text, or the email it came in.
export async function marketForDoc(companyId: string, parts: string[], markets?: Awaited<ReturnType<typeof companyMarkets>>) {
  return findMarket(parts.join("\n"), markets ?? (await companyMarkets(companyId)))?.id ?? null;
}

// The company's client accounts with their websites and contacts' emails, and our own email domains
// (which say nothing about the client), for finding who a proposal is for.
export async function companyAccounts(companyId: string) {
  const [rows, team] = await Promise.all([
    db.account.findMany({ where: { companyId }, select: { id: true, name: true, website: true, contacts: { select: { email: true } } } }),
    db.user.findMany({ where: { companyId }, select: { email: true } }),
  ]);
  return {
    accounts: rows.map((a) => ({ id: a.id, name: a.name, website: a.website, emails: a.contacts.flatMap((c) => (c.email ? [c.email] : [])) })),
    ownDomains: team.map((u) => u.email),
  };
}

// The client account a file is for: from the addresses it was sent to, else its file name and text.
export async function accountForDoc(companyId: string, to: string[], parts: string[], known?: Awaited<ReturnType<typeof companyAccounts>>) {
  const { accounts, ownDomains } = known ?? (await companyAccounts(companyId));
  return findAccount({ to, text: parts.join("\n") }, accounts, ownDomains)?.id ?? null;
}

// Quote files added before Mothership read their total, market or the date they were made.
export function unreadDetails(companyId: string, ownerId?: string): Prisma.QuoteDocWhereInput {
  return { companyId, ...(ownerId ? { ownerId } : {}), OR: [{ totalReadAt: null, totalCents: null }, { fileDate: null }, { marketReadAt: null, branchId: null }, { accountReadAt: null, accountId: null }] };
}

// Reads what's missing from each such file, one at a time, until `budgetMs` runs out: the total,
// market and client account
// (files with none are marked as tried, so they aren't opened again) and the date the file was made
// (when it doesn't say, the date it was added). Returns how many are left.
export async function readQuoteDocDetails(companyId: string, ownerId?: string, budgetMs = 40_000): Promise<number> {
  const started = Date.now();
  const [markets, accounts] = await Promise.all([companyMarkets(companyId), companyAccounts(companyId)]);
  while (Date.now() - started < budgetMs) {
    const docs = await db.quoteDoc.findMany({ where: unreadDetails(companyId, ownerId), select: { id: true }, orderBy: { uploadedAt: "desc" }, take: 10 });
    if (!docs.length) break;
    for (const { id } of docs) {
      if (Date.now() - started >= budgetMs) break;
      const doc = await db.quoteDoc.findUniqueOrThrow({
        where: { id },
        select: { fileName: true, data: true, totalCents: true, totalReadAt: true, fileDate: true, uploadedAt: true, branchId: true, marketReadAt: true, emailSubject: true, emailTo: true, accountId: true, accountReadAt: true },
      });
      const data: Prisma.QuoteDocUpdateInput = {};
      const needTotal = doc.totalCents === null && !doc.totalReadAt;
      const needMarket = !doc.branchId && !doc.marketReadAt;
      const needAccount = !doc.accountId && !doc.accountReadAt;
      const text = needTotal || needMarket || needAccount ? await documentText(doc.fileName, doc.data) : "";
      if (needTotal) {
        data.totalCents = findProposalTotal(text);
        data.totalReadAt = new Date();
      }
      if (needMarket) {
        const branchId = await marketForDoc(companyId, [doc.fileName, doc.emailSubject ?? "", doc.emailTo ?? "", text], markets);
        if (branchId) data.branch = { connect: { id: branchId } };
        data.marketReadAt = new Date();
      }
      if (needAccount) {
        const to = (doc.emailTo ?? "").split(/[,;\s]+/).filter(Boolean);
        const accountId = await accountForDoc(companyId, to, [doc.fileName, doc.emailSubject ?? "", text], accounts);
        if (accountId) data.account = { connect: { id: accountId } };
        data.accountReadAt = new Date();
      }
      if (!doc.fileDate) data.fileDate = (await documentDate(doc.fileName, doc.data)) ?? doc.uploadedAt;
      await db.quoteDoc.update({ where: { id }, data });
    }
  }
  return db.quoteDoc.count({ where: unreadDetails(companyId, ownerId) });
}
