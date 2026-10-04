import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { Avatar, PageHeader } from "@/components/ui";
import { changeRole } from "./actions";
import { NewUserForm } from "./forms";

export default async function UsersPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/settings/profile");
  const users = await db.user.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } });
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Team" subtitle={`${users.length} people at ${user.company.name}`} />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><span className="flex items-center gap-2"><Avatar name={u.name} /> {u.name}</span></td>
                <td className="text-slate-600">{u.email}</td>
                <td>
                  <form action={changeRole.bind(null, u.id)} className="flex gap-2">
                    <select name="role" defaultValue={u.role} className="input w-auto py-1">
                      {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    <button className="btn py-1">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Add a teammate</h2>
        <NewUserForm />
      </section>
    </div>
  );
}
