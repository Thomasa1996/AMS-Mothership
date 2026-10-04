import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { listScope } from "@/lib/prospect-lists";
import { NewBusinessTabs } from "./tabs";

export default async function NewBusinessLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const lists = await db.prospectList.count({ where: listScope(user) });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New Business Development</h1>
          <p className="text-sm text-slate-500">Find prospects in Apollo, save them to lists, and add them to the CRM. Searching and lists are free; adding someone to the CRM uses 1 Apollo credit.</p>
        </div>
        <NewBusinessTabs lists={lists} />
      </div>
      {children}
    </div>
  );
}
