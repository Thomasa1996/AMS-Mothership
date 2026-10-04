import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { listScope } from "@/lib/prospect-lists";
import { crmStatus } from "../../crm-status";
import { deleteList } from "../../list-actions";
import { ListView, RenameList } from "./list-view";

export default async function ProspectListPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const list = await db.prospectList.findFirst({
    where: { id, ...listScope(user) },
    include: { owner: { select: { name: true } }, items: { orderBy: { addedAt: "asc" } } },
  });
  if (!list) notFound();
  const status = await crmStatus(user, list.items.map((i) => i.apolloId));
  const inCrm = list.items.filter((i) => status.has(i.apolloId)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/sales/new-business/lists" className="text-sm text-slate-500 hover:text-slate-800">&larr; Lists</Link>
          <RenameList listId={list.id} name={list.name} />
          <p className="text-sm text-slate-500">
            {list.items.length} people, {inCrm} in the CRM{list.ownerId !== user.id ? ` · made by ${list.owner.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {list.items.length > 0 && <a href={`/sales/new-business/lists/${list.id}/csv`} className="btn">Download CSV</a>}
          <ConfirmButton
            action={deleteList.bind(null, list.id)}
            label="Delete list"
            confirmText={`Delete the list "${list.name}"? Anyone already added to the CRM stays there.`}
            className="text-sm text-slate-500 hover:text-red-600"
          />
        </div>
      </div>
      <div className="card overflow-x-auto">
        {list.items.length === 0 ? (
          <EmptyState>This list is empty. <Link href="/sales/new-business" className="link">Search Apollo</Link> to add people.</EmptyState>
        ) : (
          <ListView
            canOpenAll={user.role !== "SALES"}
            items={list.items.map((i) => {
              const s = status.get(i.apolloId);
              return {
                id: i.id,
                apolloId: i.apolloId,
                name: s?.contactName ?? ([i.firstName, i.lastName].filter(Boolean).join(" ") || "Name hidden"),
                title: i.title,
                companyName: i.companyName,
                email: s?.email ?? null,
                inCrm: s ? { id: s.id, name: s.name, canOpen: s.canOpen } : null,
              };
            })}
          />
        )}
      </div>
    </div>
  );
}
