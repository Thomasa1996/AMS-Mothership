import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ownerChoices } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { createAccount } from "../../actions";
import { AccountForm } from "../../forms";

export default async function NewAccountPage() {
  const user = await requireUser();
  const users = await db.user.findMany({ where: ownerChoices(user), select: { id: true, name: true }, orderBy: { name: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="New company" />
      <div className="card p-5">
        <AccountForm action={createAccount} users={users} defaults={{ ownerId: user.id }} submitLabel="Create company" />
      </div>
    </div>
  );
}
