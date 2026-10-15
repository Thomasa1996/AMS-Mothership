import "server-only";
import { db } from "./db";
import { createCompanyNote, HubSpotError, uploadFile } from "./hubspot";
import { open } from "./secret-box";

// Sends quote files from Sales > Quotes to HubSpot: each one whose client account came from HubSpot is
// uploaded and attached, as a note, to that company. Each file is sent once; changing its account
// afterwards doesn't move it in HubSpot. Files that failed are tried again with the daily sync or
// Send now in Settings > HubSpot.

const FOLDER = "/Mothership quotes";
// A claim older than this belongs to a send that died, so the file can be tried again.
const CLAIM_MS = 3 * 60 * 1000;

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// Quote files waiting to go: matched to a HubSpot company, not sent, and not stuck on an error.
export const waitingForHubSpot = (companyId: string) => ({
  companyId,
  hubspotSentAt: null,
  hubspotError: null,
  account: { hubspotId: { not: null } },
});

export type SendResult = { sent: number; failed: number; error?: string };

export async function sendQuotesToHubSpot(companyId: string, budgetMs = 25_000): Promise<SendResult> {
  const started = Date.now();
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { hubspotToken: true, hubspotQuotes: true } });
  const token = company.hubspotToken ? open(company.hubspotToken) : null;
  if (!token || !company.hubspotQuotes) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  while (Date.now() - started < budgetMs) {
    const stale = new Date(Date.now() - CLAIM_MS);
    const next = await db.quoteDoc.findFirst({
      where: { ...waitingForHubSpot(companyId), OR: [{ hubspotClaimAt: null }, { hubspotClaimAt: { lt: stale } }] },
      select: { id: true, hubspotClaimAt: true },
      orderBy: { uploadedAt: "asc" },
    });
    if (!next) break;
    // Claim it, so two sends running at once don't both attach it.
    const claimed = await db.quoteDoc.updateMany({ where: { id: next.id, hubspotSentAt: null, hubspotClaimAt: next.hubspotClaimAt }, data: { hubspotClaimAt: new Date() } });
    if (!claimed.count) continue;
    const doc = await db.quoteDoc.findUniqueOrThrow({
      where: { id: next.id },
      select: {
        fileName: true, contentType: true, data: true, totalCents: true, outcome: true, fileDate: true, uploadedAt: true, emailSubject: true, hubspotFileId: true,
        ownerId: true, branchId: true, accountId: true,
      },
    });
    const [owner, branch, account] = await Promise.all([
      db.user.findUnique({ where: { id: doc.ownerId }, select: { name: true } }),
      doc.branchId ? db.branch.findUnique({ where: { id: doc.branchId }, select: { name: true } }) : null,
      db.account.findUnique({ where: { id: doc.accountId! }, select: { hubspotId: true } }),
    ]);
    if (!account?.hubspotId) {
      await db.quoteDoc.update({ where: { id: next.id }, data: { hubspotClaimAt: null } });
      continue;
    }
    try {
      let fileId = doc.hubspotFileId;
      if (!fileId) {
        fileId = (await uploadFile(token, doc.fileName, doc.contentType, doc.data, FOLDER)).id;
        await db.quoteDoc.update({ where: { id: next.id }, data: { hubspotFileId: fileId } });
      }
      const lines = [
        `<p><strong>Quote: ${escape(doc.fileName)}</strong></p>`,
        doc.totalCents !== null ? `<p>Total: ${money(doc.totalCents)}</p>` : "",
        doc.outcome ? `<p>Status: ${doc.outcome === "WON" ? "Won" : "Lost"}</p>` : "",
        branch ? `<p>Market: ${escape(branch.name)}</p>` : "",
        owner ? `<p>Rep: ${escape(owner.name)}</p>` : "",
        doc.emailSubject ? `<p>Email: ${escape(doc.emailSubject)}</p>` : "",
        "<p>Sent from Mothership</p>",
      ];
      const note = await createCompanyNote(token, account.hubspotId, lines.join(""), doc.fileDate ?? doc.uploadedAt, [fileId]);
      await db.quoteDoc.update({ where: { id: next.id }, data: { hubspotNoteId: note.id, hubspotSentAt: new Date(), hubspotClaimAt: null } });
      sent++;
    } catch (e) {
      const message = e instanceof HubSpotError ? e.message : "Couldn't reach HubSpot.";
      // A key problem stops every file the same way, so mark this one (Settings > HubSpot shows it)
      // and leave the rest waiting.
      if (e instanceof HubSpotError && (e.status === 401 || e.status === 403)) {
        await db.quoteDoc.update({ where: { id: next.id }, data: { hubspotError: message, hubspotClaimAt: null } });
        return { sent, failed: failed + 1, error: message };
      }
      if (!(e instanceof HubSpotError)) console.error("Sending a quote to HubSpot failed", e);
      await db.quoteDoc.update({ where: { id: next.id }, data: { hubspotError: message, hubspotClaimAt: null } });
      failed++;
    }
  }
  return { sent, failed };
}
