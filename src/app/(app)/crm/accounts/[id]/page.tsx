import { sourceLabel } from "@/lib/constants";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { accountScope, ownerChoices } from "@/lib/access";
import { formatCurrency, formatDate } from "@/lib/format";
import { Avatar, EmptyState, Field, PageHeader, StageBadge } from "@/components/ui";
import { addActivity, createContact, deleteAccount, deleteContact, updateAccount } from "../../actions";
import { AccountForm, ActivityForm, ConfirmButton, ContactForm } from "../../forms";
import { ActivityFeed } from "../../activity-feed";
import { photoUrl } from "@/lib/photos";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const account = await db.account.findFirst({
    where: { id, ...accountScope(user) },
    include: {
      owner: { select: { id: true, name: true, photoAt: true } },
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      projects: { orderBy: { createdAt: "desc" }, include: { manager: { select: { name: true } } } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true } }, project: { select: { name: true } } },
      },
    },
  });
  if (!account) notFound();
  const users = await db.user.findMany({ where: ownerChoices(user), select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title={account.name}
        subtitle={
          <span className="flex items-center gap-2">
            {account.industry && <span>{account.industry}</span>}
            {account.owner && (
              <span className="flex items-center gap-1.5">
                · Owner <Avatar name={account.owner.name} photoUrl={photoUrl(account.owner)} /> {account.owner.name}
              </span>
            )}
            {!account.owner && account.hubspotOwnerName && (
              <span title="No teammate has this owner's HubSpot email yet">· HubSpot owner {account.hubspotOwnerName}</span>
            )}
          </span>
        }
        actions={
          <Link href={`/crm/projects/new?accountId=${account.id}`} className="btn btn-primary">New project</Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="font-semibold">Projects</h2>
            </div>
            {account.projects.length === 0 ? (
              <EmptyState>No projects for this account yet.</EmptyState>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Stage</th>
                    <th>Move date</th>
                    <th>Manager</th>
                    <th className="text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {account.projects.map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/crm/projects/${p.id}`} className="link">{p.name}</Link></td>
                      <td><StageBadge stage={p.stage} /></td>
                      <td>{formatDate(p.moveDate)}</td>
                      <td>{p.manager?.name}</td>
                      <td className="text-right">{formatCurrency(p.estimatedValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Activity</h2>
            <div className="mb-5">
              <ActivityForm action={addActivity.bind(null, { accountId: account.id })} />
            </div>
            <ActivityFeed items={account.activities} showProject />
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Details</h2>
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Phone">{account.phone}</Field>
              <Field label="Website">{account.website}</Field>
              <Field label="Source">{sourceLabel(account.source)}</Field>
              <Field label="Created">{formatDate(account.createdAt)}</Field>
              <div className="col-span-2">
                <Field label="Address">{account.address}</Field>
              </div>
            </dl>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-brand-600">Edit account</summary>
              <div className="mt-3">
                <AccountForm
                  action={updateAccount.bind(null, account.id)}
                  users={users}
                  defaults={account}
                  submitLabel="Save changes"
                />
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <ConfirmButton
                  action={deleteAccount.bind(null, account.id)}
                  label="Delete account"
                  confirmText={`Delete ${account.name} and all its contacts, projects and activity?`}
                />
              </div>
            </details>
          </section>

          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Contacts</h2>
            {account.contacts.length === 0 ? (
              <p className="mb-3 text-sm text-slate-500">No contacts yet.</p>
            ) : (
              <ul className="mb-4 divide-y divide-slate-100">
                {account.contacts.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 py-2.5">
                    <div className="min-w-0 text-sm">
                      <div className="font-medium">
                        {c.name}
                        {c.isPrimary && <span className="ml-2 badge bg-brand-50 text-brand-700">Primary</span>}
                      </div>
                      {c.title && <div className="text-slate-500">{c.title}</div>}
                      {c.email && <a href={`mailto:${c.email}`} className="block truncate text-brand-600">{c.email}</a>}
                      {c.phone && <div className="text-slate-600">{c.phone}</div>}
                    </div>
                    <ConfirmButton
                      action={deleteContact.bind(null, c.id)}
                      label="Remove"
                      confirmText={`Remove ${c.name}?`}
                      className="text-xs text-slate-400 hover:text-red-600"
                    />
                  </li>
                ))}
              </ul>
            )}
            <details>
              <summary className="cursor-pointer text-sm font-medium text-brand-600">Add contact</summary>
              <div className="mt-3">
                <ContactForm action={createContact.bind(null, account.id)} />
              </div>
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
