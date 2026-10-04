import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/ui";
import { limitedToOwn } from "@/lib/access";
import { listScope } from "@/lib/prospect-lists";

export default async function ProspectListsPage() {
  const user = await requireUser();
  const lists = await db.prospectList.findMany({
    where: listScope(user),
    include: { owner: { select: { name: true } }, _count: { select: { items: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const showOwner = !limitedToOwn(user);

  return (
    <div className="card overflow-x-auto">
      {lists.length === 0 ? (
        <EmptyState>
          No lists yet. <Link href="/sales/new-business" className="link">Search Apollo</Link>, tick the people you want, and save them to a list.
        </EmptyState>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>List</th>
              {showOwner && <th>Made by</th>}
              <th className="text-right">People</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {lists.map((l) => (
              <tr key={l.id}>
                <td><Link href={`/sales/new-business/lists/${l.id}`} className="link font-medium">{l.name}</Link></td>
                {showOwner && <td>{l.owner.name}</td>}
                <td className="text-right tabular-nums">{l._count.items}</td>
                <td className="whitespace-nowrap text-slate-500">{l.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
