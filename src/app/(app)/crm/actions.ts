"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { closedAtFor, stageLabel } from "@/lib/constants";
import { accountScope, limitedToOwn, projectScope } from "@/lib/access";
import {
  AccountSchema,
  ActivitySchema,
  ContactSchema,
  ProjectSchema,
  StageSchema,
  firstError,
  formToObject,
  type FormState,
} from "@/lib/validation";

// Every action loads the signed-in user and scopes reads and writes to their company,
// and for salespeople to the accounts they own (see lib/access.ts).

type User = Awaited<ReturnType<typeof requireUser>>;

async function assertUserInCompany(userId: string | null, companyId: string) {
  if (!userId) return;
  const found = await db.user.findFirst({ where: { id: userId, companyId }, select: { id: true } });
  if (!found) throw new Error("That person isn't on your team");
}

async function getAccountOrThrow(accountId: string, user: User) {
  const account = await db.account.findFirst({ where: { id: accountId, ...accountScope(user) } });
  if (!account) throw new Error("Account not found");
  return account;
}

async function getProjectOrThrow(projectId: string, user: User) {
  const project = await db.project.findFirst({ where: { id: projectId, ...projectScope(user) } });
  if (!project) throw new Error("Project not found");
  return project;
}

// Salespeople can't hand accounts to someone else; only admins reassign owners.
function ownerFor(requested: string | null | undefined, user: User) {
  if (limitedToOwn(user)) {
    if (requested && requested !== user.id) throw new Error("Only an admin can give an account to someone else");
    return user.id;
  }
  return requested ?? user.id;
}

function errorState(e: unknown): FormState {
  return { error: e instanceof Error ? e.message : "Something went wrong" };
}

// Accounts

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = AccountSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  let id: string;
  try {
    await assertUserInCompany(parsed.data.ownerId, user.companyId);
    const account = await db.account.create({
      data: { ...parsed.data, ownerId: ownerFor(parsed.data.ownerId, user), companyId: user.companyId },
    });
    id = account.id;
  } catch (e) {
    return errorState(e);
  }
  revalidatePath("/crm");
  redirect(`/crm/accounts/${id}`);
}

export async function updateAccount(accountId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = AccountSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await getAccountOrThrow(accountId, user);
    await assertUserInCompany(parsed.data.ownerId, user.companyId);
    await db.account.update({ where: { id: accountId }, data: { ...parsed.data, ownerId: ownerFor(parsed.data.ownerId, user) } });
  } catch (e) {
    return errorState(e);
  }
  revalidatePath("/crm");
  return { ok: true };
}

export async function deleteAccount(accountId: string) {
  const user = await requireUser();
  await getAccountOrThrow(accountId, user);
  await db.account.delete({ where: { id: accountId } });
  revalidatePath("/crm");
  redirect("/crm/accounts");
}

// Contacts

export async function createContact(accountId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = ContactSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await getAccountOrThrow(accountId, user);
    await db.$transaction(async (tx) => {
      if (parsed.data.isPrimary) {
        await tx.contact.updateMany({ where: { accountId }, data: { isPrimary: false } });
      }
      await tx.contact.create({ data: { ...parsed.data, accountId, companyId: user.companyId } });
    });
  } catch (e) {
    return errorState(e);
  }
  revalidatePath(`/crm/accounts/${accountId}`);
  return { ok: true };
}

export async function deleteContact(contactId: string) {
  const user = await requireUser();
  const contact = await db.contact.findFirst({ where: { id: contactId, companyId: user.companyId, account: accountScope(user) } });
  if (!contact) throw new Error("Contact not found");
  await db.contact.delete({ where: { id: contactId } });
  revalidatePath(`/crm/accounts/${contact.accountId}`);
}

// Projects

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = ProjectSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  let id: string;
  try {
    await getAccountOrThrow(parsed.data.accountId, user);
    await assertUserInCompany(parsed.data.managerId, user.companyId);
    const project = await db.project.create({
      data: { ...parsed.data, ...closedAtFor(null, parsed.data.stage, null), companyId: user.companyId },
    });
    await db.activity.create({
      data: {
        companyId: user.companyId,
        accountId: project.accountId,
        projectId: project.id,
        userId: user.id,
        type: "STAGE_CHANGE",
        body: `Project created in ${stageLabel(project.stage)}`,
      },
    });
    id = project.id;
  } catch (e) {
    return errorState(e);
  }
  revalidatePath("/crm");
  redirect(`/crm/projects/${id}`);
}

export async function updateProject(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = ProjectSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    const existing = await getProjectOrThrow(projectId, user);
    await getAccountOrThrow(parsed.data.accountId, user);
    await assertUserInCompany(parsed.data.managerId, user.companyId);
    await db.project.update({ where: { id: projectId }, data: { ...parsed.data, ...closedAtFor(existing.stage, parsed.data.stage, existing.closedAt) } });
    if (existing.stage !== parsed.data.stage) {
      await logStageChange(user, parsed.data.accountId, projectId, existing.stage, parsed.data.stage);
    }
  } catch (e) {
    return errorState(e);
  }
  revalidatePath("/crm");
  return { ok: true };
}

export async function setProjectStage(projectId: string, stage: string) {
  const user = await requireUser();
  const nextStage = StageSchema.parse(stage);
  const existing = await getProjectOrThrow(projectId, user);
  if (existing.stage === nextStage) return;
  await db.project.update({ where: { id: projectId }, data: { stage: nextStage, ...closedAtFor(existing.stage, nextStage, existing.closedAt) } });
  await logStageChange(user, existing.accountId, projectId, existing.stage, nextStage);
  revalidatePath("/crm");
}

export async function deleteProject(projectId: string) {
  const user = await requireUser();
  const project = await getProjectOrThrow(projectId, user);
  await db.project.delete({ where: { id: projectId } });
  revalidatePath("/crm");
  redirect(`/crm/accounts/${project.accountId}`);
}

async function logStageChange(
  user: { id: string; companyId: string },
  accountId: string,
  projectId: string,
  from: string,
  to: string,
) {
  await db.activity.create({
    data: {
      companyId: user.companyId,
      accountId,
      projectId,
      userId: user.id,
      type: "STAGE_CHANGE",
      body: `Stage changed from ${stageLabel(from)} to ${stageLabel(to)}`,
    },
  });
}

// Activity

export async function addActivity(
  target: { accountId: string; projectId?: string },
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = ActivitySchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await getAccountOrThrow(target.accountId, user);
    if (target.projectId) {
      const project = await getProjectOrThrow(target.projectId, user);
      if (project.accountId !== target.accountId) throw new Error("Project not found");
    }
    await db.activity.create({
      data: {
        ...parsed.data,
        companyId: user.companyId,
        accountId: target.accountId,
        projectId: target.projectId ?? null,
        userId: user.id,
      },
    });
  } catch (e) {
    return errorState(e);
  }
  revalidatePath("/crm");
  return { ok: true };
}
