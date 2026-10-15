import "server-only";
import { db } from "./db";
import { open } from "./secret-box";
import { documentDate, documentText } from "./doc-text";
import { contentTypeFor } from "./file-upload";
import { makeThumbnail } from "./thumbnail";
import { accountForDoc, companyAccounts, companyMarkets, marketForDoc } from "./quote-doc-totals";
import { findProposalTotal } from "./proposal-total";
import { formatCents } from "./quote-math";
import { MailError, attachmentBytes, getMailToken, listAttachments, looksLikeProposal, sentWithAttachments, type MailCreds } from "./mail-graph";

export async function mailCreds(companyId: string): Promise<MailCreds | null> {
  const c = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { mailTenantId: true, mailClientId: true, mailSecret: true } });
  const secret = c.mailSecret ? open(c.mailSecret) : null;
  return c.mailTenantId && c.mailClientId && secret ? { tenantId: c.mailTenantId, clientId: c.mailClientId, secret } : null;
}

// How far back the first pull goes when no date is set: the start of this year.
export const defaultMailSince = () => new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));

// Looks through the Sent Items of everyone switched on in Settings > Email proposals, oldest first
// from where it last stopped, and files each proposal attachment in Sales > Quotes under the person
// who sent it, with its total when one can be read. Stops after `budgetMs` so it fits in one request;
// the next run carries on from there.
export async function runMailProposalSync(companyId: string, budgetMs = 45_000): Promise<{ ok: boolean; message: string }> {
  const started = Date.now();
  const creds = await mailCreds(companyId);
  if (!creds) return { ok: false, message: "Microsoft 365 isn't connected." };
  const [company, people] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: companyId }, select: { mailSince: true } }),
    db.user.findMany({ where: { companyId, active: true, mailProposals: true }, select: { id: true, name: true, email: true, mailCursor: true }, orderBy: { name: "asc" } }),
  ]);
  if (!people.length) return { ok: false, message: "Nobody is switched on yet. Tick whose sent email to read." };
  const since = company.mailSince ?? defaultMailSince();
  const [markets, accounts] = await Promise.all([companyMarkets(companyId), companyAccounts(companyId)]);

  let ok = true;
  let added = 0;
  let addedCents = 0;
  let unread = 0;
  let more = false;
  const problems: string[] = [];
  try {
    const token = await getMailToken(creds);
    for (const person of people) {
      let cursor = person.mailCursor && person.mailCursor > since ? person.mailCursor : since;
      try {
        while (Date.now() - started < budgetMs) {
          const messages = await sentWithAttachments(token, person.email, cursor);
          for (const m of messages) {
            if (Date.now() - started >= budgetMs) break;
            for (const a of await listAttachments(token, person.email, m.id)) {
              if (!looksLikeProposal(m.subject, a)) continue;
              const emailKey = `${m.internetMessageId}|${a.name}`;
              if (await db.quoteDoc.findFirst({ where: { companyId, emailKey }, select: { id: true } })) continue;
              const data = await attachmentBytes(token, person.email, m.id, a.id);
              const text = await documentText(a.name, data);
              const totalCents = findProposalTotal(text);
              const branchId = await marketForDoc(companyId, [a.name, m.subject, m.to.join(" "), text], markets);
              const accountId = await accountForDoc(companyId, m.to, [a.name, m.subject, text], accounts);
              // Word and Excel previews are made here; a PDF's is drawn the first time someone sees it.
              const thumbnail = await makeThumbnail(a.name, contentTypeFor(a.name), data);
              await db.quoteDoc.create({
                data: {
                  companyId,
                  ownerId: person.id,
                  fileName: a.name,
                  contentType: contentTypeFor(a.name),
                  size: data.length,
                  data,
                  uploadedAt: new Date(m.sentDateTime),
                  totalCents,
                  totalReadAt: new Date(),
                  thumbnail,
                  fileDate: (await documentDate(a.name, data)) ?? new Date(m.sentDateTime),
                  branchId,
                  marketReadAt: new Date(),
                  accountId,
                  accountReadAt: new Date(),
                  emailKey,
                  emailSubject: m.subject.slice(0, 500) || null,
                  emailTo: m.to.join(", ").slice(0, 500) || null,
                },
              });
              added++;
              if (totalCents === null) unread++;
              else addedCents += totalCents;
            }
            cursor = new Date(m.sentDateTime);
            await db.user.update({ where: { id: person.id }, data: { mailCursor: cursor } });
          }
          if (messages.length < 25) break;
        }
        if (Date.now() - started >= budgetMs) {
          more = true;
          break;
        }
      } catch (e) {
        problems.push(`${person.name}: ${e instanceof MailError ? e.message : "couldn't be read."}`);
      }
    }
    if (problems.length === people.length) ok = false;
  } catch (e) {
    ok = false;
    problems.push(e instanceof MailError ? e.message : "Couldn't reach Microsoft 365. Try again.");
  }

  let message = `Pulled ${added} ${added === 1 ? "proposal" : "proposals"}${added ? ` worth ${formatCents(addedCents)}` : ""}.`;
  if (unread) message += ` ${unread} had no total Mothership could read; type those in on Sales › Quotes.`;
  if (more) message += " There's more to go through; it carries on with the next pull.";
  if (problems.length) message += ` ${problems.join(" ")}`;
  if (!ok) message = `Failed: ${problems.join(" ")}`;
  await db.company.update({ where: { id: companyId }, data: { mailSyncedAt: new Date(), mailSyncResult: message } });
  return { ok, message };
}
