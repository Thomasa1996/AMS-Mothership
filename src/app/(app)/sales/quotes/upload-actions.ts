"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { projectScope, quoteScope } from "@/lib/access";
import { readPdf } from "@/lib/pdf-upload";
import { formatCents, parseDollarsToCents } from "@/lib/quote-math";
import { firstError, formToObject, type FormState } from "@/lib/validation";

// Quotes written in Word and uploaded as a PDF. They sit in the same list, with the same statuses,
// as quotes built in Mothership; only the document is the rep's own.

const DetailsSchema = z.object({
  title: z.string().trim().min(1, "Give the quote a title"),
  quoteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the quote date"),
  total: z.string().transform((v, ctx) => {
    const cents = parseDollarsToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter the quote total in dollars" });
      return z.NEVER;
    }
    return cents;
  }),
});

export async function uploadQuote(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const form = formToObject(formData);
  const parsed = DetailsSchema.safeParse(form);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const project = await db.project.findFirst({ where: { id: String(form.projectId ?? ""), ...projectScope(user) } });
  if (!project) return { error: "Pick the project this quote is for" };
  const branchId = String(form.branchId ?? "") || null;
  if (branchId && !(await db.branch.findFirst({ where: { id: branchId, companyId: user.companyId }, select: { id: true } }))) {
    return { error: "Market not found" };
  }
  const pdf = await readPdf(formData.get("file"));
  if ("error" in pdf) return pdf;
  const { title, quoteDate, total } = parsed.data;

  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      const last = await tx.quote.aggregate({ where: { companyId: user.companyId }, _max: { number: true } });
      const quote = await tx.quote.create({
        data: {
          companyId: user.companyId,
          projectId: project.id,
          branchId,
          number: (last._max.number ?? 1000) + 1,
          title,
          quoteDate: new Date(`${quoteDate}T12:00:00Z`),
          totalCents: total,
          uploaded: true,
          createdById: user.id,
          // The built-in proposal fields aren't used for an uploaded PDF.
          clientLabel: "",
          serviceDescription: "",
          intro: "",
          scopeTitle: "",
          investmentHeading: "",
          totalLabel: "",
          valuation: "",
          companyDuties: "",
          clientDuties: "",
          file: { create: { fileName: pdf.fileName, data: pdf.data, size: pdf.data.length } },
        },
      });
      await tx.activity.create({
        data: {
          companyId: user.companyId,
          accountId: project.accountId,
          projectId: project.id,
          userId: user.id,
          type: "NOTE",
          body: `Quote #${quote.number} "${quote.title}" uploaded as a PDF for ${formatCents(total)}`,
        },
      });
      return quote.id;
    });
  } catch {
    return { error: "Couldn't save the quote. Try again." };
  }
  revalidatePath("/sales/quotes");
  redirect(`/sales/quotes/${id}`);
}

async function uploadedQuoteOrThrow(id: string) {
  const user = await requireUser();
  const quote = await db.quote.findFirst({ where: { id, uploaded: true, ...quoteScope(user) }, select: { id: true } });
  if (!quote) throw new Error("Quote not found");
  return quote;
}

export async function replaceQuotePdf(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await uploadedQuoteOrThrow(id);
  const pdf = await readPdf(formData.get("file"));
  if ("error" in pdf) return pdf;
  await db.quoteFile.upsert({
    where: { quoteId: id },
    create: { quoteId: id, fileName: pdf.fileName, data: pdf.data, size: pdf.data.length },
    update: { fileName: pdf.fileName, data: pdf.data, size: pdf.data.length, uploadedAt: new Date() },
  });
  revalidatePath(`/sales/quotes/${id}`);
  return { ok: true };
}

export async function updateUploadedQuote(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await uploadedQuoteOrThrow(id);
  const parsed = DetailsSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await db.quote.update({
    where: { id },
    data: { title: parsed.data.title, quoteDate: new Date(`${parsed.data.quoteDate}T12:00:00Z`), totalCents: parsed.data.total },
  });
  revalidatePath(`/sales/quotes/${id}`);
  revalidatePath("/sales/quotes");
  return { ok: true };
}
