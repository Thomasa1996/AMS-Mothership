import type { PrismaClient } from "@prisma/client";
import { listAll, listDealStages, listOwners, type HubSpotRecord, type HubSpotStage } from "./hubspot";

// One-way sync from HubSpot into Mothership, used while the team moves off HubSpot.
// - Companies become accounts, contacts go under their company, deals become projects.
// - A contact with no company linked in HubSpot goes under the account named in its Company name
//   field (created if needed), or under one "No company in HubSpot" account.
// - A record is updated only when HubSpot changed it since the last sync, so edits made in
//   Mothership (a project moved to In progress, say) stick until someone changes it in HubSpot.
// - Nothing is ever deleted in Mothership.
// - Callers must not run two syncs for a company at once (see lib/hubspot-run.ts), since HubSpot ids
//   aren't a unique index.

export const COMPANY_PROPS = ["name", "domain", "website", "phone", "industry", "address", "city", "state", "zip", "hubspot_owner_id", "hs_lastmodifieddate"];
export const CONTACT_PROPS = ["firstname", "lastname", "email", "phone", "mobilephone", "jobtitle", "company", "hubspot_owner_id", "lastmodifieddate"];
export const DEAL_PROPS = ["dealname", "dealstage", "amount", "hubspot_owner_id", "hs_lastmodifieddate", "description"];

// HubSpot's default sales pipeline. Other pipelines fall back to each stage's win probability.
const DEFAULT_STAGES: Record<string, string> = {
  appointmentscheduled: "LEAD",
  qualifiedtobuy: "LEAD",
  presentationscheduled: "SURVEY",
  decisionmakerboughtin: "QUOTED",
  contractsent: "QUOTED",
  closedwon: "BOOKED",
  closedlost: "LOST",
};

export function mapDealStage(stageId: string | null | undefined, stages: HubSpotStage[] = []): string {
  if (!stageId) return "LEAD";
  if (DEFAULT_STAGES[stageId]) return DEFAULT_STAGES[stageId];
  const stage = stages.find((s) => s.id === stageId);
  const probability = Number(stage?.metadata?.probability ?? NaN);
  if (stage?.metadata?.isClosed === "true") return probability > 0 ? "BOOKED" : "LOST";
  if (probability >= 0.6) return "QUOTED";
  if (probability >= 0.3) return "SURVEY";
  return "LEAD";
}

const clean = (v: string | null | undefined) => {
  const t = v?.trim();
  return t ? t : null;
};

// HubSpot industry values look like "LOGISTICS_AND_SUPPLY_CHAIN".
export function industryLabel(v: string | null | undefined) {
  const t = clean(v);
  if (!t) return null;
  const words = t.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function companyToAccount(r: HubSpotRecord) {
  const p = r.properties;
  const site = clean(p.website) ?? clean(p.domain);
  const cityLine = [clean(p.city), [clean(p.state), clean(p.zip)].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return {
    name: clean(p.name) ?? clean(p.domain) ?? `HubSpot company ${r.id}`,
    website: site,
    phone: clean(p.phone),
    industry: industryLabel(p.industry),
    address: [clean(p.address), cityLine].filter(Boolean).join(", ") || null,
  };
}

export function contactFields(r: HubSpotRecord) {
  const p = r.properties;
  const name = [clean(p.firstname), clean(p.lastname)].filter(Boolean).join(" ") || clean(p.email) || "Unnamed contact";
  return { name, title: clean(p.jobtitle), email: clean(p.email)?.toLowerCase() ?? null, phone: clean(p.phone) ?? clean(p.mobilephone) };
}

export function dealToProject(r: HubSpotRecord, stages: HubSpotStage[]) {
  const p = r.properties;
  const amount = Number(p.amount);
  return {
    name: clean(p.dealname) ?? `HubSpot deal ${r.id}`,
    stage: mapDealStage(p.dealstage, stages),
    estimatedValue: Number.isFinite(amount) && p.amount ? Math.round(amount) : null,
    notes: clean(p.description),
  };
}

function modifiedAt(r: HubSpotRecord, prop: string) {
  const raw = r.properties[prop] ?? r.updatedAt;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : new Date(0);
}

const firstCompany = (r: HubSpotRecord) => r.associations?.companies?.results[0]?.id ?? null;

export const NO_COMPANY_ACCOUNT = "No company in HubSpot";

// Account names compare ignoring case and spacing ("Move Logistix " matches "move logistix").
export const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

// The account a contact with no linked HubSpot company belongs under.
export function fallbackAccountName(r: HubSpotRecord) {
  return clean(r.properties.company)?.replace(/\s+/g, " ") ?? NO_COMPANY_ACCOUNT;
}

const isNewer = (incoming: Date, stored: Date | null) => !stored || incoming.getTime() > stored.getTime();

export type SyncResult = {
  accounts: { created: number; updated: number };
  contacts: { created: number; updated: number };
  projects: { created: number; updated: number; skipped: number };
  unmatchedOwners: string[];
};

export function describeSync(r: SyncResult) {
  const parts = [
    `${r.accounts.created} new and ${r.accounts.updated} updated accounts`,
    `${r.contacts.created} new and ${r.contacts.updated} updated contacts`,
    `${r.projects.created} new and ${r.projects.updated} updated projects`,
  ];
  let text = parts.join("; ") + ".";
  if (r.projects.skipped) text += ` ${r.projects.skipped} deals have no company in HubSpot, so they were skipped.`;
  if (r.unmatchedOwners.length) {
    text += ` No teammate has the email of these HubSpot owners, so their accounts have no owner yet: ${r.unmatchedOwners.join(", ")}.`;
  }
  return text;
}

const chunk = <T,>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

// actorId is the teammate the sync's activity entries are logged under (the admin who ran it).
export async function syncHubSpot(db: PrismaClient, companyId: string, token: string, actorId: string): Promise<SyncResult> {
  const [owners, stages, companies, contacts, deals] = await Promise.all([
    listOwners(token),
    listDealStages(token),
    listAll(token, "companies", COMPANY_PROPS),
    listAll(token, "contacts", CONTACT_PROPS, "companies"),
    listAll(token, "deals", DEAL_PROPS, "companies"),
  ]);

  // Owners -> teammates by email.
  const users = await db.user.findMany({ where: { companyId }, select: { id: true, email: true } });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const ownerInfo = new Map(
    owners.map((o) => [
      String(o.id),
      { userId: o.email ? userByEmail.get(o.email.toLowerCase()) ?? null : null, name: [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || `Owner ${o.id}` },
    ]),
  );
  const unmatched = new Set<string>();

  // Accounts
  const existingAccounts = await db.account.findMany({
    where: { companyId, hubspotId: { not: null } },
    select: { id: true, hubspotId: true, hubspotModifiedAt: true },
  });
  const accountByHs = new Map(existingAccounts.map((a) => [a.hubspotId!, a]));
  const accountCreates = [];
  const accountUpdates = [];
  for (const c of companies) {
    const owner = c.properties.hubspot_owner_id ? ownerInfo.get(c.properties.hubspot_owner_id) : undefined;
    if (owner && !owner.userId) unmatched.add(owner.name);
    const data = {
      ...companyToAccount(c),
      ownerId: owner?.userId ?? null,
      hubspotOwnerName: owner && !owner.userId ? owner.name : null,
      hubspotModifiedAt: modifiedAt(c, "hs_lastmodifieddate"),
    };
    const existing = accountByHs.get(c.id);
    if (!existing) accountCreates.push({ ...data, companyId, source: "HUBSPOT", hubspotId: c.id });
    else if (isNewer(data.hubspotModifiedAt, existing.hubspotModifiedAt)) accountUpdates.push({ id: existing.id, data });
  }
  for (const batch of chunk(accountCreates, 500)) await db.account.createMany({ data: batch });
  for (const batch of chunk(accountUpdates, 100)) {
    await db.$transaction(batch.map((u) => db.account.update({ where: { id: u.id }, data: u.data })));
  }
  const accountIds = new Map(
    (await db.account.findMany({ where: { companyId, hubspotId: { not: null } }, select: { id: true, hubspotId: true } })).map((a) => [a.hubspotId!, a.id]),
  );

  // Contacts
  const existingContacts = await db.contact.findMany({
    where: { companyId, hubspotId: { not: null } },
    select: { id: true, hubspotId: true, hubspotModifiedAt: true },
  });
  const contactByHs = new Map(existingContacts.map((c) => [c.hubspotId!, c]));
  const contactCreates = [];
  const contactUpdates = [];
  // Most contacts in HubSpot have only a Company name typed in, not a linked company. Those go under
  // the account with that name, created here (owned by the contact's owner) when none exists yet.
  const loose = contacts.filter((c) => {
    const hs = firstCompany(c);
    return !hs || !accountIds.has(hs);
  });
  const accountByName = new Map<string, string>();
  for (const a of await db.account.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } })) {
    if (!accountByName.has(nameKey(a.name))) accountByName.set(nameKey(a.name), a.id);
  }
  const fallbackCreates = new Map<string, { companyId: string; name: string; source: string; ownerId: string | null; hubspotOwnerName: string | null }>();
  for (const c of loose) {
    const name = fallbackAccountName(c);
    const key = nameKey(name);
    if (accountByName.has(key) || fallbackCreates.has(key)) continue;
    const owner = name !== NO_COMPANY_ACCOUNT && c.properties.hubspot_owner_id ? ownerInfo.get(c.properties.hubspot_owner_id) : undefined;
    if (owner && !owner.userId) unmatched.add(owner.name);
    fallbackCreates.set(key, { companyId, name, source: "HUBSPOT", ownerId: owner?.userId ?? null, hubspotOwnerName: owner && !owner.userId ? owner.name : null });
  }
  for (const batch of chunk([...fallbackCreates.values()], 500)) await db.account.createMany({ data: batch });
  if (fallbackCreates.size) {
    const made = await db.account.findMany({ where: { companyId, hubspotId: null, name: { in: [...fallbackCreates.values()].map((a) => a.name) } }, select: { id: true, name: true } });
    for (const a of made) if (!accountByName.has(nameKey(a.name))) accountByName.set(nameKey(a.name), a.id);
  }

  for (const c of contacts) {
    const companyHs = firstCompany(c);
    const accountId = (companyHs ? accountIds.get(companyHs) : undefined) ?? accountByName.get(nameKey(fallbackAccountName(c)))!;
    const data = { ...contactFields(c), accountId, hubspotModifiedAt: modifiedAt(c, "lastmodifieddate") };
    const existing = contactByHs.get(c.id);
    if (!existing) contactCreates.push({ ...data, companyId, hubspotId: c.id });
    else if (isNewer(data.hubspotModifiedAt, existing.hubspotModifiedAt)) contactUpdates.push({ id: existing.id, data });
  }
  for (const batch of chunk(contactCreates, 500)) await db.contact.createMany({ data: batch });
  for (const batch of chunk(contactUpdates, 100)) {
    await db.$transaction(batch.map((u) => db.contact.update({ where: { id: u.id }, data: u.data })));
  }
  // Each account with contacts but no primary gets its first contact marked primary, so quotes fill in.
  const noPrimary = await db.account.findMany({
    where: { companyId, contacts: { some: {}, none: { isPrimary: true } } },
    select: { contacts: { select: { id: true }, orderBy: { createdAt: "asc" }, take: 1 } },
  });
  const primaryIds = noPrimary.map((a) => a.contacts[0]!.id);
  if (primaryIds.length) await db.contact.updateMany({ where: { id: { in: primaryIds } }, data: { isPrimary: true } });

  // Projects
  const existingProjects = await db.project.findMany({
    where: { companyId, hubspotId: { not: null } },
    select: { id: true, hubspotId: true, hubspotModifiedAt: true, stage: true, accountId: true },
  });
  const projectByHs = new Map(existingProjects.map((p) => [p.hubspotId!, p]));
  let projectsCreated = 0;
  let projectsUpdated = 0;
  let projectsSkipped = 0;
  const activities: { companyId: string; accountId: string; projectId: string; userId: string; type: string; body: string }[] = [];
  for (const d of deals) {
    const companyHs = firstCompany(d);
    const accountId = companyHs ? accountIds.get(companyHs) : undefined;
    if (!accountId) {
      projectsSkipped++;
      continue;
    }
    const data = { ...dealToProject(d, stages), accountId, hubspotModifiedAt: modifiedAt(d, "hs_lastmodifieddate") };
    const existing = projectByHs.get(d.id);
    if (!existing) {
      const created = await db.project.create({ data: { ...data, companyId, hubspotId: d.id } });
      activities.push({ companyId, accountId, projectId: created.id, userId: actorId, type: "STAGE_CHANGE", body: "Imported from HubSpot" });
      projectsCreated++;
    } else if (isNewer(data.hubspotModifiedAt, existing.hubspotModifiedAt)) {
      await db.project.update({ where: { id: existing.id }, data });
      if (existing.stage !== data.stage) {
        activities.push({ companyId, accountId, projectId: existing.id, userId: actorId, type: "STAGE_CHANGE", body: "Stage updated from HubSpot" });
      }
      projectsUpdated++;
    }
  }
  if (activities.length) await db.activity.createMany({ data: activities });

  return {
    accounts: { created: accountCreates.length + fallbackCreates.size, updated: accountUpdates.length },
    contacts: { created: contactCreates.length, updated: contactUpdates.length },
    projects: { created: projectsCreated, updated: projectsUpdated, skipped: projectsSkipped },
    unmatchedOwners: [...unmatched].sort(),
  };
}
