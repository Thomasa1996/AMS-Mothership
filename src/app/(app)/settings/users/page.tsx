import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { PhotoUpload } from "@/components/photo-upload";
import { photoUrl } from "@/lib/photos";
import { changeRole, restoreUser } from "./actions";
import { NewUserForm, RemoveUserButton, SetPasswordButton } from "./forms";

export default async function UsersPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/settings/profile");
  const everyone = await db.user.findMany({
    where: { companyId: user.companyId },
    select: { id: true, name: true, email: true, role: true, photoAt: true, active: true, _count: { select: { ownedAccounts: true } } },
    orderBy: { name: "asc" },
  });
  const users = everyone.filter((u) => u.active);
  const removed = everyone.filter((u) => !u.active);
  const teammates = users.map((u) => ({ id: u.id, name: u.name }));
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Team" subtitle={`${users.length} people at ${user.company.name}. Click Add photo next to anyone to upload their picture.`} />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Photo</th><th>Name</th><th>Email</th><th>Role</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><PhotoUpload userId={u.id} name={u.name} photoUrl={photoUrl(u)} /></td>
                <td className="font-medium">{u.name}</td>
                <td className="text-slate-600">{u.email}</td>
                <td>
                  <form action={changeRole.bind(null, u.id)} className="flex gap-2">
                    <select name="role" defaultValue={u.role} className="input w-auto py-1">
                      {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    <button className="btn py-1">Save</button>
                  </form>
                </td>
                <td className="text-right">
                  {u.id === user.id ? (
                    <span className="text-xs text-slate-400">You</span>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <SetPasswordButton user={{ id: u.id, name: u.name }} />
                      <RemoveUserButton user={{ id: u.id, name: u.name, accounts: u._count.ownedAccounts }} teammates={teammates} defaultHandTo={user.id} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {removed.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-1 font-semibold">Removed</h2>
          <p className="mb-3 text-sm text-slate-500">These people can&apos;t sign in. Restore someone to let them back in; their old companies stay with whoever took them over.</p>
          <ul className="divide-y divide-slate-100">
            {removed.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span><span className="font-medium">{u.name}</span> <span className="text-slate-500">{u.email}</span></span>
                <form action={restoreUser.bind(null, u.id)}><button className="btn py-1">Restore</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Add a teammate</h2>
        <NewUserForm />
      </section>
    </div>
  );
}
