import { db } from "@/lib/db";
import { templateFor } from "@/lib/quote-template";
import { projectScope } from "@/lib/access";

type Viewer = { id: string; companyId: string; role: string };
import type { ProjectOption, QuoteDraft, RateOption } from "./builder";

export async function builderOptions(user: Viewer): Promise<{ projects: ProjectOption[]; rates: RateOption[] }> {
  const { companyId } = user;
  const [projects, rates] = await Promise.all([
    db.project.findMany({
      where: projectScope(user),
      include: { account: { include: { contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }], take: 1 } } } },
      orderBy: [{ account: { name: "asc" } }, { name: "asc" }],
    }),
    db.rateItem.findMany({ where: { companyId, active: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
  ]);
  return {
    projects: projects.map((p) => {
      const c = p.account.contacts[0];
      return {
        id: p.id,
        name: p.name,
        accountName: p.account.name,
        contact: c ? { name: c.name, title: c.title, phone: c.phone, email: c.email } : null,
      };
    }),
    rates: rates.map((r) => ({ id: r.id, category: r.category, name: r.name, unit: r.unit, rateCents: r.rateCents, notes: r.notes })),
  };
}

export async function newQuoteDraft(user: Viewer, projectId?: string): Promise<QuoteDraft> {
  const company = await db.company.findUniqueOrThrow({ where: { id: user.companyId } });
  const t = templateFor(company);
  const project = projectId
    ? await db.project.findFirst({
        where: { id: projectId, ...projectScope(user) },
        include: { account: { include: { contacts: { orderBy: [{ isPrimary: "desc" }], take: 1 } } } },
      })
    : null;
  const contact = project?.account.contacts[0];
  return {
    projectId: project?.id ?? "",
    title: project?.name ?? "",
    quoteDate: new Date().toISOString().slice(0, 10),
    serviceDescription: "",
    recipientName: contact?.name ?? "",
    recipientTitle: contact?.title ?? "",
    recipientCompany: project?.account.name ?? "",
    recipientPhone: contact?.phone ?? "",
    recipientEmail: contact?.email ?? "",
    clientLabel: project?.account.name ?? "",
    clientLogo: "",
    scopeTitle: "Primary Relocation/Installation",
    timeline: "",
    scope: "",
    investmentHeading: t.investmentHeading,
    totalLabel: "Firm Fixed Project Total",
    // Keep {company} placeholders so a later rename flows through; {service} too.
    intro: t.intro,
    valuation: t.valuation,
    optionalValuation: t.optionalValuation,
    companyDuties: t.companyDuties,
    clientDuties: t.clientDuties,
    lines: [{ key: "line-0", category: "", description: "", quantity: "1", unit: "flat", rate: "", note: "" }],
  };
}

export function draftFromQuote(q: {
  projectId: string;
  title: string;
  quoteDate: Date;
  serviceDescription: string;
  recipientName: string | null;
  recipientTitle: string | null;
  recipientCompany: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  clientLabel: string;
  clientLogo: string | null;
  scopeTitle: string;
  timeline: string | null;
  scope: string | null;
  investmentHeading: string;
  totalLabel: string;
  intro: string;
  valuation: string;
  optionalValuation: string | null;
  companyDuties: string;
  clientDuties: string;
  lines: { id: string; category: string; description: string; quantity: number; unit: string; rateCents: number; note: string | null }[];
}): QuoteDraft {
  return {
    projectId: q.projectId,
    title: q.title,
    quoteDate: q.quoteDate.toISOString().slice(0, 10),
    serviceDescription: q.serviceDescription,
    recipientName: q.recipientName ?? "",
    recipientTitle: q.recipientTitle ?? "",
    recipientCompany: q.recipientCompany ?? "",
    recipientPhone: q.recipientPhone ?? "",
    recipientEmail: q.recipientEmail ?? "",
    clientLabel: q.clientLabel,
    clientLogo: q.clientLogo ?? "",
    scopeTitle: q.scopeTitle,
    timeline: q.timeline ?? "",
    scope: q.scope ?? "",
    investmentHeading: q.investmentHeading,
    totalLabel: q.totalLabel,
    intro: q.intro,
    valuation: q.valuation,
    optionalValuation: q.optionalValuation ?? "",
    companyDuties: q.companyDuties,
    clientDuties: q.clientDuties,
    lines: q.lines.map((l) => ({
      key: l.id,
      category: l.category,
      description: l.description,
      quantity: String(l.quantity),
      unit: l.unit,
      rate: (l.rateCents / 100).toFixed(2),
      note: l.note ?? "",
    })),
  };
}

