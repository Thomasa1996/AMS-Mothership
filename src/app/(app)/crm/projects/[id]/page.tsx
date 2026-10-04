import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatCurrency, formatDate, toDateInput } from "@/lib/format";
import { Field, PageHeader, StageBadge } from "@/components/ui";
import { addActivity, deleteProject, updateProject } from "../../actions";
import { ActivityForm, ConfirmButton, ProjectForm } from "../../forms";
import { ActivityFeed } from "../../activity-feed";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      account: { include: { contacts: { where: { isPrimary: true }, take: 1 } } },
      manager: true,
      activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!project) notFound();
  const [accounts, users] = await Promise.all([
    db.account.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
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
          <section className="card p-4 text-sm text-slate-600">
            <p className="mb-2 font-semibold text-slate-900">Coming next</p>
            <p>Quotes (Phase 2) and the crew schedule and task checklist (Phase 3) will appear on this page.</p>
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
