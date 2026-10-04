"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { stageLabel } from "@/lib/constants";
import { firstError } from "@/lib/validation";
import { QUOTE_STATUS_IDS, QuoteInput, formatCents, lineAmountCents, quoteStatusLabel, quoteTotalCents } from "@/lib/quote-math";
import { z } from "zod";

export type SaveState = { error?: string };

type User = Awaited<ReturnType<typeof requireUser>>;

async function getQuoteOrThrow(id: string, companyId: string) {
  const quote = await db.quote.findFirst({ where: { id, companyId }, include: { project: true } });
  if (!quote) throw new Error("Quote not found");
  return quote;
}

function lineRows(lines: z.output<typeof QuoteInput>["lines"]) {
  return lines.map((l, i) => ({ ...l, position: i, amountCents: lineAmountCents(l.quantity, l.rateCents) }));
}

async function parseInput(input: unknown, user: User) {
  const parsed = QuoteInput.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) } as const;
  const project = await db.project.findFirst({ where: { id: parsed.data.projectId, companyId: user.companyId } });
  if (!project) return { error: "Project not found" } as const;
  return { data: parsed.data, project } as const;
}

export async function createQuote(input: unknown): Promise<SaveState> {
  const user = await requireUser();
  const result = await parseInput(input, user);
  if ("error" in result) return { error: result.error };
  const { lines, ...fields } = result.data;

  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      const last = await tx.quote.aggregate({ where: { companyId: user.companyId }, _max: { number: true } });
      const quote = await tx.quote.create({
        data: {
          ...fields,
          companyId: user.companyId,
          number: (last._max.number ?? 1000) + 1,
          createdById: user.id,
          totalCents: quoteTotalCents(lines),
          lines: { create: lineRows(lines) },
        },
      });
      await tx.activity.create({
        data: {
          companyId: user.companyId,
          accountId: result.project.accountId,
          projectId: result.project.id,
          userId: user.id,
          type: "NOTE",
          body: `Quote #${quote.number} "${quote.title}" drafted for ${formatCents(quote.totalCents)}`,
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

export async function updateQuote(id: string, input: unknown): Promise<SaveState> {
  const user = await requireUser();
  const result = await parseInput(input, user);
  if ("error" in result) return { error: result.error };
  const { lines, ...fields } = result.data;
  try {
    await getQuoteOrThrow(id, user.companyId);
    await db.$transaction([
      db.quoteLine.deleteMany({ where: { quoteId: id } }),
      db.quote.update({
        where: { id },
        data: { ...fields, totalCents: quoteTotalCents(lines), lines: { create: lineRows(lines) } },
      }),
    ]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't save the quote" };
  }
  revalidatePath("/sales/quotes");
  revalidatePath(`/crm/projects/${result.project.id}`);
  redirect(`/sales/quotes/${id}`);
}

// Sending moves an early-stage project to Quoted; accepting books it and sets its value to the quote total.
export async function setQuoteStatus(id: string, status: string) {
  const user = await requireUser();
  const next = z.enum(QUOTE_STATUS_IDS).parse(status);
  const quote = await getQuoteOrThrow(id, user.companyId);
  if (quote.status === next) return;

  const now = new Date();
  const project = quote.project;
  let nextStage: string | null = null;
  if (next === "SENT" && ["LEAD", "SURVEY"].includes(project.stage)) nextStage = "QUOTED";
  if (next === "ACCEPTED" && ["LEAD", "SURVEY", "QUOTED", "LOST"].includes(project.stage)) nextStage = "BOOKED";

  await db.$transaction([
    db.quote.update({
      where: { id },
      data: {
        status: next,
        sentAt: next === "SENT" ? now : quote.sentAt,
        decidedAt: next === "ACCEPTED" || next === "DECLINED" ? now : null,
      },
    }),
    ...(next === "ACCEPTED"
      ? [db.project.update({ where: { id: project.id }, data: { estimatedValue: Math.round(quote.totalCents / 100) } })]
      : []),
    ...(nextStage ? [db.project.update({ where: { id: project.id }, data: { stage: nextStage } })] : []),
    db.activity.create({
      data: {
        companyId: user.companyId,
        accountId: project.accountId,
        projectId: project.id,
        userId: user.id,
        type: "STAGE_CHANGE",
        body:
          `Quote #${quote.number} marked ${quoteStatusLabel(next).toLowerCase()}` +
          (nextStage ? `; project moved from ${stageLabel(project.stage)} to ${stageLabel(nextStage)}` : ""),
      },
    }),
  ]);
  revalidatePath("/sales/quotes");
  revalidatePath("/crm");
}

export async function duplicateQuote(id: string) {
  const user = await requireUser();
  const quote = await db.quote.findFirst({ where: { id, companyId: user.companyId }, include: { lines: true } });
  if (!quote) throw new Error("Quote not found");
  const { id: _id, number: _n, createdAt: _c, updatedAt: _u, sentAt: _s, decidedAt: _d, lines, ...rest } = quote;
  const copyId = await db.$transaction(async (tx) => {
    const last = await tx.quote.aggregate({ where: { companyId: user.companyId }, _max: { number: true } });
    const copy = await tx.quote.create({
      data: {
        ...rest,
        title: `${quote.title} (revised)`,
        status: "DRAFT",
        number: (last._max.number ?? 1000) + 1,
        createdById: user.id,
        lines: { create: lines.map(({ id: _l, quoteId: _q, ...l }) => l) },
      },
    });
    return copy.id;
  });
  revalidatePath("/sales/quotes");
  redirect(`/sales/quotes/${copyId}/edit`);
}

export async function deleteQuote(id: string) {
  const user = await requireUser();
  await getQuoteOrThrow(id, user.companyId);
  await db.quote.delete({ where: { id } });
  revalidatePath("/sales/quotes");
  redirect("/sales/quotes");
}
