import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { accountScope, projectScope, quoteScope } from "@/lib/access";
import { formatCurrency, formatDate, toDateInput } from "@/lib/format";
import { Field, PageHeader, StageBadge } from "@/components/ui";
import { addActivity, deleteProject, updateProject } from "../../actions";
import { ActivityForm, ConfirmButton, ProjectForm } from "../../forms";
import { ActivityFeed } from "../../activity-feed";
import { formatCents } from "@/lib/quote-math";
import { QuoteStatusBadge } from "@/app/(app)/sales/quotes/status";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, ...projectScope(user) },
    include: {
      account: { include: { contacts: { where: { isPrimary: true }, take: 1 } } },
      manager: true,
      activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      quotes: { where: quoteScope(user), orderBy: { number: "desc" } },
    },
  });
  if (!project) notFound();
  const [accounts, users] = await Promise.all([
    db.account.findMany({ where: accountScope(user), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const contact = project.account.contacts[0];

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={
          <span className="flex items-center gap-2">
            <Link href={`/crm/accounts/${project.account.id}`} className="link">{project.account.name}</Link>
            <StageBadge stage={project.stage} />
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Edit project</h2>
            <ProjectForm
              action={updateProject.bind(null, project.id)}
              accounts={accounts}
              users={users}
              defaults={{ ...project, moveDate: toDateInput(project.moveDate) }}
              submitLabel="Save changes"
            />
          </section>
          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Activity</h2>
            <div className="mb-5">
              <ActivityForm action={addActivity.bind(null, { accountId: project.accountId, projectId: project.id })} />
            </div>
            <ActivityFeed items={project.activities} />
          </section>
        </div>
        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Summary</h2>
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Move date">{formatDate(project.moveDate)}</Field>
              <Field label="Value">{formatCurrency(project.estimatedValue)}</Field>
              <Field label="Manager">{project.manager?.name}</Field>
              <Field label="Primary contact">{contact?.name}</Field>
              <div className="col-span-2"><Field label="Moving from">{project.originAddress}</Field></div>
              <div className="col-span-2"><Field label="Moving to">{project.destinationAddress}</Field></div>
            </dl>
          </section>
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Quotes</h2>
              <Link href={`/sales/quotes/new?projectId=${project.id}`} className="btn py-1">New quote</Link>
            </div>
            {project.quotes.length === 0 ? (
              <p className="text-sm text-slate-500">No quotes yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {project.quotes.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0">
                      <Link href={`/sales/quotes/${q.id}`} className="link">#{q.number} {q.title}</Link>
                      <span className="ml-2"><QuoteStatusBadge status={q.status} /></span>
                    </span>
                    <span className="whitespace-nowrap font-medium">{formatCents(q.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <ConfirmButton
            action={deleteProject.bind(null, project.id)}
            label="Delete project"
            confirmText={`Delete ${project.name}?`}
          />
        </div>
      </div>
    </div>
  );
}
