import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { accountScope, limitedToOwn } from "@/lib/access";
import { formatCurrency } from "@/lib/format";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";

const OPEN_STAGES = ["LEAD", "SURVEY", "QUOTED", "BOOKED", "IN_PROGRESS"];

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ q?: string; owner?: string }> }) {
  const user = await requireUser();
  const { q = "", owner = "" } = await searchParams;

  const [accounts, users] = await Promise.all([
    db.account.findMany({
      where: {
        ...accountScope(user),
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
        ...(owner === "me" ? { ownerId: user.id } : owner ? { ownerId: owner } : {}),
      },
      include: {
        owner: { select: { name: true } },
        contacts: { where: { isPrimary: true }, take: 1, select: { name: true } },
        projects: { select: { stage: true, estimatedValue: true } },
        _count: { select: { contacts: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.user.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle={`${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`}
        actions={<Link href="/crm/accounts/new" className="btn btn-primary">New account</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" name="q" defaultValue={q} placeholder="Search accounts" />
        {!limitedToOwn(user) && (
          <select className="input w-auto" name="owner" defaultValue={owner}>
            <option value="">All owners</option>
            <option value="me">My accounts</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
        <button className="btn">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        {accounts.length === 0 ? (
          <EmptyState>No accounts yet. Create one to get started.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Industry</th>
                <th>Primary contact</th>
                <th>Owner</th>
                <th className="text-right">Open projects</th>
                <th className="text-right">Open pipeline</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const open = a.projects.filter((p) => OPEN_STAGES.includes(p.stage));
                const pipeline = open.reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0);
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td>
                      <Link href={`/crm/accounts/${a.id}`} className="link">{a.name}</Link>
                      {a.source !== "MANUAL" && <span className="ml-2 badge bg-slate-100 text-slate-600">{a.source === "APOLLO" ? "Apollo" : "HubSpot"}</span>}
                    </td>
                    <td className="text-slate-600">{a.industry}</td>
                    <td className="text-slate-600">
                      {a.contacts[0]?.name}
                      {a._count.contacts > 1 && <span className="text-slate-400"> +{a._count.contacts - 1}</span>}
                    </td>
                    <td>
                      {a.owner && (
                        <span className="flex items-center gap-2">
                          <Avatar name={a.owner.name} /> {a.owner.name}
                        </span>
                      )}
                      {!a.owner && a.hubspotOwnerName && (
                        <span className="text-slate-500" title="No teammate has this owner's HubSpot email yet">
                          {a.hubspotOwnerName} (HubSpot)
                        </span>
                      )}
                    </td>
                    <td className="text-right">{open.length || ""}</td>
                    <td className="text-right font-medium">{pipeline ? formatCurrency(pipeline) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
