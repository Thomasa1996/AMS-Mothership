import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { createProject } from "../../actions";
import { ProjectForm } from "../../forms";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ accountId?: string }> }) {
  const user = await requireUser();
  const { accountId } = await searchParams;
  const [accounts, users] = await Promise.all([
    db.account.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="New project" />
      <div className="card p-5">
        <ProjectForm action={createProject} accounts={accounts} users={users} defaults={{ accountId }} submitLabel="Create project" />
      </div>
    </div>
  );
}
