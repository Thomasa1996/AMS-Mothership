import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { branchDetails } from "@/lib/branches";
import { PageHeader } from "@/components/ui";
import { saveBranchProfile } from "../../actions";
import { ProfileEditor } from "./profile-editor";

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (user.role !== "ADMIN") redirect(`/sales/warehouses/${id}`);
  const branch = await db.branch.findFirst({ where: { id, companyId: user.companyId } });
  if (!branch) notFound();
  const { warehouses, contacts, profile } = branchDetails(branch);
  return (
    <div className="space-y-3">
      <Link href={`/sales/warehouses/${branch.id}`} className="text-sm text-slate-500 hover:text-slate-700">&larr; {branch.name}</Link>
      <PageHeader title={`Edit ${branch.name} profile`} subtitle="Changes show for everyone as soon as you save." />
      <ProfileEditor
        branchId={branch.id}
        save={saveBranchProfile.bind(null, branch.id)}
        initial={{ name: branch.name, profileDate: branch.profileDate ?? "", approval: branch.approval ?? "", warehouses, contacts, profile }}
      />
    </div>
  );
}
