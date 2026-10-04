import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { STAGES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { EmptyState, PageHeader, StageBadge } from "@/components/ui";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; stage?: string }> }) {
  const user = await requireUser();
  const { q = "", stage = "" } = await searchParams;
  const projects = await db.project.findMany({
    where: {
      companyId: user.companyId,
      ...(stage ? { stage } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { account: { name: { contains: q } } }] } : {}),
    },
    include: { account: { select: { id: true, name: true } }, manager: { select: { name: true } } },
    orderBy: [{ moveDate: "asc" }, { createdAt: "desc" }],
  });
  const total = projects.reduce((s, p) => s + (p.estimatedValue ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} projects · ${formatCurrency(total)} total value`}
        actions={<Link href="/crm/projects/new" className="btn btn-primary">New project</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" name="q" defaultValue={q} placeholder="Search projects or accounts" />
        <select className="input w-auto" name="stage" defaultValue={stage}>
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <button className="btn">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        {projects.length === 0 ? (
          <EmptyState>No projects match.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Account</th>
                <th>Stage</th>
                <th>Move date</th>
                <th>Manager</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td><Link href={`/crm/projects/${p.id}`} className="link">{p.name}</Link></td>
                  <td><Link href={`/crm/accounts/${p.account.id}`} className="text-slate-700 hover:underline">{p.account.name}</Link></td>
                  <td><StageBadge stage={p.stage} /></td>
                  <td>{formatDate(p.moveDate)}</td>
                  <td>{p.manager?.name}</td>
                  <td className="text-right">{formatCurrency(p.estimatedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
