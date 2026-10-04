import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { PipelineBoard } from "./board";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const user = await requireUser();
  const { mine } = await searchParams;
  const projects = await db.project.findMany({
    where: { companyId: user.companyId, ...(mine ? { account: { ownerId: user.id } } : {}) },
    include: { account: { select: { name: true } }, manager: { select: { name: true } } },
    orderBy: [{ moveDate: "asc" }],
  });
  const open = projects.filter((p) => !["COMPLETED", "LOST"].includes(p.stage));
  const openValue = open.reduce((s, p) => s + (p.estimatedValue ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle={`${open.length} open projects · ${formatCurrency(openValue)} open value · drag a card to change its stage`}
        actions={
          <form>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="mine" value="1" defaultChecked={!!mine} /> Only my accounts
              <button className="btn">Apply</button>
            </label>
          </form>
        }
      />
      <PipelineBoard
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          stage: p.stage,
          accountName: p.account.name,
          moveDate: p.moveDate?.toISOString() ?? null,
          estimatedValue: p.estimatedValue,
          managerName: p.manager?.name ?? null,
        }))}
      />
    </div>
  );
}
