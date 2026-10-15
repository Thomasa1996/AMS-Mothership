"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PICTURE_TYPES, makeThumbnail, toThumbnail } from "@/lib/thumbnail";
import { readOfficeFile } from "@/lib/file-upload";
import { documentDate, documentText } from "@/lib/doc-text";
import { findProposalTotal } from "@/lib/proposal-total";
import { marketForDoc, readQuoteDocDetails } from "@/lib/quote-doc-totals";
import { limitedToOwn } from "@/lib/access";
import { parseDollarsToCents } from "@/lib/quote-math";
import type { FormState } from "@/lib/validation";

// One file per call, so each request stays under the upload size limit.
export async function addQuoteDoc(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = await readOfficeFile(formData.get("file"));
  if ("error" in file) return file;
  const text = await documentText(file.fileName, file.data);
  const totalCents = findProposalTotal(text);
  const branchId = await marketForDoc(user.companyId, [file.fileName, text]);
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
    },
  });
  revalidatePath("/sales/quotes");
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
  return left;
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

// The market a quote file's work is in ("" clears it). Same people as removing.
export async function setQuoteDocMarket(id: string, branchId: string): Promise<FormState> {
  const user = await requireUser();
  if (branchId && !(await db.branch.findFirst({ where: { id: branchId, companyId: user.companyId }, select: { id: true } }))) return { error: "Market not found" };
  const { count } = await db.quoteDoc.updateMany({ where: editable(user, id), data: { branchId: branchId || null, marketReadAt: new Date() } });
  if (!count) return { error: "Quote not found" };
  revalidatePath("/sales/quotes");
  return { ok: true };
}
