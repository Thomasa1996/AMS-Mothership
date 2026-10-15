import "server-only";
import { db } from "./db";
import { documentText } from "./doc-text";
import { findProposalTotal } from "./proposal-total";
import { formatCents } from "./quote-math";

// Quote files Mothership hasn't tried reading a total from yet (added before it read them on upload).
export const unreadTotals = (companyId: string, ownerId?: string) => ({ companyId, totalReadAt: null, totalCents: null, ...(ownerId ? { ownerId } : {}) });

// Reads the total from each such file, one at a time, until `budgetMs` runs out. Files with no
// readable total are marked as tried, so they aren't opened again; their total can be typed in.
export async function readQuoteDocTotals(companyId: string, ownerId?: string, budgetMs = 40_000): Promise<string> {
  const started = Date.now();
  let read = 0;
  let found = 0;
  let cents = 0;
  while (Date.now() - started < budgetMs) {
    const docs = await db.quoteDoc.findMany({ where: unreadTotals(companyId, ownerId), select: { id: true }, orderBy: { uploadedAt: "desc" }, take: 10 });
    if (!docs.length) break;
    for (const { id } of docs) {
      if (Date.now() - started >= budgetMs) break;
      const doc = await db.quoteDoc.findUniqueOrThrow({ where: { id }, select: { fileName: true, data: true } });
      const totalCents = findProposalTotal(await documentText(doc.fileName, doc.data));
      await db.quoteDoc.update({ where: { id }, data: { totalCents, totalReadAt: new Date() } });
      read++;
      if (totalCents !== null) {
        found++;
        cents += totalCents;
      }
    }
  }
  const left = await db.quoteDoc.count({ where: unreadTotals(companyId, ownerId) });
  let message = `Read ${read} ${read === 1 ? "file" : "files"}: found ${found} ${found === 1 ? "total" : "totals"} worth ${formatCents(cents)}.`;
  if (read > found) message += ` ${read - found} had no total to read; type those in.`;
  if (left) message += ` ${left} still to go; click again.`;
  return message;
}
