"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PICTURE_TYPES, makeThumbnail, toThumbnail } from "@/lib/thumbnail";
import { readOfficeFile } from "@/lib/file-upload";
import { documentDate, documentText } from "@/lib/doc-text";
import { findProposalTotal } from "@/lib/proposal-total";
import { accountForDoc, marketForDoc, readQuoteDocDetails } from "@/lib/quote-doc-totals";
import { sendQuotesToHubSpot } from "@/lib/hubspot-quotes";
import { limitedToOwn } from "@/lib/access";
import { parseDollarsToCents } from "@/lib/quote-math";
import type { FormState } from "@/lib/validation";
import { OUT_OF_MARKET } from "@/lib/market-forecast";

// One file per call, so each request stays under the upload size limit.
export async function addQuoteDoc(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = await readOfficeFile(formData.get("file"));
  if ("error" in file) return file;
  const text = await documentText(file.fileName, file.data);
  const totalCents = findProposalTotal(text);
  const branchId = await marketForDoc(user.companyId, [file.fileName, text]);
  const accountId = await accountForDoc(user.companyId, [], [file.fileName, text]);
  // PDFs come with a preview drawn in the browser; pictures and Office files are made here.
  const drawn = await drawnThumbnail(formData);
  const thumbnail = drawn ?? (await makeThumbnail(file.fileName, file.contentType, file.data));
  await db.quoteDoc.create({
    data: {
      companyId: user.companyId,
      ownerId: user.id,
      fileName: file.fileName,
      contentType: file.contentType,
      size: file.data.length,
      data: file.data,
      totalCents,
      totalReadAt: new Date(),
      thumbnail,
      fileDate: (await documentDate(file.fileName, file.data)) ?? computerDate(formData.get("lastModified")) ?? new Date(),
      branchId,
      marketReadAt: new Date(),
      accountId,
      accountReadAt: new Date(),
    },
  });
  revalidatePath("/sales/quotes");
  if (accountId) after(() => sendQuietly(user.companyId));
  return { ok: true };
}

// Reps remove their own files; admins can remove anyone's.
export async function deleteQuoteDoc(id: string) {
  const user = await requireUser();
  await db.quoteDoc.deleteMany({ where: { id, companyId: user.companyId, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) } });
  revalidatePath("/sales/quotes");
}

// The proposal's total, read from the file or typed in; blank clears it. Same people as removing.
export async function setQuoteDocTotal(id: string, value: string): Promise<FormState> {
  const user = await requireUser();
  const cents = value.trim() ? parseDollarsToCents(value) : null;
  if (value.trim() && cents === null) return { error: "Enter dollars, like 12,500" };
  const { count } = await db.quoteDoc.updateMany({
    where: { id, companyId: user.companyId, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) },
    data: { totalCents: cents },
  });
  if (!count) return { error: "Quote not found" };
  revalidatePath("/sales/quotes");
  return { ok: true };
}

// Reads totals and dates from files added before Mothership read them on upload: the viewer's own,
// or everyone's for those who see every rep. Returns how many are left.
export async function readMissingDetails(): Promise<number> {
  const user = await requireUser();
  const left = await readQuoteDocDetails(user.companyId, limitedToOwn(user) ? user.id : undefined, 25_000);
  revalidatePath("/sales/quotes");
  after(() => sendQuietly(user.companyId));
  return left;
}

// Sends waiting quote files to HubSpot after the reply has gone back (when it's switched on). Problems
// show in Settings > HubSpot, so they aren't reported here.
async function sendQuietly(companyId: string) {
  try {
    await sendQuotesToHubSpot(companyId, 20_000);
  } catch (e) {
    console.error("Sending quotes to HubSpot failed", e);
  }
}

// The client account a quote file is for ("" clears it). Same people as removing. A file already in
// HubSpot stays where it was sent; one that isn't goes to its new account.
export async function setQuoteDocAccount(id: string, accountId: string): Promise<FormState & { name?: string }> {
  const user = await requireUser();
  const account = accountId ? await db.account.findFirst({ where: { id: accountId, companyId: user.companyId }, select: { id: true, name: true } }) : null;
  if (accountId && !account) return { error: "Account not found" };
  const { count } = await db.quoteDoc.updateMany({
    where: editable(user, id),
    data: { accountId: account?.id ?? null, accountReadAt: new Date(), hubspotError: null },
  });
  if (!count) return { error: "Quote not found" };
  revalidatePath("/sales/quotes");
  if (account) after(() => sendQuietly(user.companyId));
  return { ok: true, name: account?.name };
}

// Accounts whose name starts with or contains what was typed, for the account picker.
export async function searchAccounts(q: string): Promise<{ id: string; name: string; inHubSpot: boolean }[]> {
  const user = await requireUser();
  const term = q.trim().slice(0, 100);
  if (term.length < 2) return [];
  return db.account.findMany({
    where: { companyId: user.companyId, name: { contains: term, mode: "insensitive" } },
    select: { id: true, name: true, hubspotId: true },
    orderBy: { name: "asc" },
    take: 8,
  }).then((rows) => rows.map((r) => ({ id: r.id, name: r.name, inHubSpot: !!r.hubspotId })));
}

// The file's date on the rep's computer, sent along by the upload box. Today's date says nothing
// (a freshly saved copy), so only an earlier one counts.
function computerDate(raw: FormDataEntryValue | null): Date | null {
  const ms = Number(raw);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const d = new Date(ms);
  return d.getUTCFullYear() >= 1990 && Date.now() - ms > 60_000 && ms <= Date.now() ? d : null;
}

async function drawnThumbnail(formData: FormData, field = "thumbnail") {
  const drawn = formData.get(field);
  if (!(drawn instanceof File) || drawn.size === 0 || drawn.size > 8 * 1024 * 1024) return null;
  return toThumbnail(new Uint8Array(await drawn.arrayBuffer()), false);
}

const editable = (user: { id: string; companyId: string; role: string }, id: string) => ({
  id,
  companyId: user.companyId,
  ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
});

// Saves the preview a browser drew for a PDF that has none yet.
export async function saveDrawnQuoteThumbnail(id: string, formData: FormData) {
  const user = await requireUser();
  const thumbnail = await drawnThumbnail(formData);
  if (thumbnail) await db.quoteDoc.updateMany({ where: { ...editable(user, id), thumbnail: null }, data: { thumbnail } });
}

// A picture the rep picks for the file (a photo of the site, the client's logo), in place of its first page.
export async function setQuoteDocPicture(id: string, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const picture = formData.get("picture");
  if (!(picture instanceof File) || !PICTURE_TYPES.has(picture.type)) return { error: "Pick a PNG, JPEG, GIF or WebP picture" };
  if (picture.size > 4 * 1024 * 1024) return { error: "That picture is over 4 MB" };
  const thumbnail = await drawnThumbnail(formData, "picture");
  if (!thumbnail) return { error: "That picture couldn't be read" };
  const { count } = await db.quoteDoc.updateMany({ where: editable(user, id), data: { thumbnail } });
  if (!count) return { error: "Quote not found" };
  revalidatePath("/sales/quotes");
  return { ok: true };
}

// Marks a quote file won or lost ("" puts it back to open). Same people as removing.
export async function setQuoteDocOutcome(id: string, outcome: string): Promise<FormState> {
  const user = await requireUser();
  if (!["", "WON", "LOST"].includes(outcome)) return { error: "Pick Won, Lost or Open" };
  const { count } = await db.quoteDoc.updateMany({ where: editable(user, id), data: { outcome: outcome || null } });
  if (!count) return { error: "Quote not found" };
  revalidatePath("/sales/quotes");
  return { ok: true };
}

// The market a quote file's work is in, OUT_OF_MARKET for work outside them all ("" clears it). Same people as removing.
export async function setQuoteDocMarket(id: string, branchId: string): Promise<FormState> {
  const user = await requireUser();
  const out = branchId === OUT_OF_MARKET;
  if (branchId && !out && !(await db.branch.findFirst({ where: { id: branchId, companyId: user.companyId }, select: { id: true } }))) return { error: "Market not found" };
  const { count } = await db.quoteDoc.updateMany({
    where: editable(user, id),
    data: { branchId: out ? null : branchId || null, outOfMarket: out, marketReadAt: new Date() },
  });
  if (!count) return { error: "Quote not found" };
  revalidatePath("/sales/quotes");
  return { ok: true };
}
