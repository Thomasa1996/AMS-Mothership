import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/quote-math";
import { rateCardFor } from "@/lib/branches";
import { PageHeader } from "@/components/ui";

export default async function RateCardPage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const user = await requireUser();
  const { market = "" } = await searchParams;
  const branches = await db.branch.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const branch = branches.find((b) => b.id === market) ?? null;
  const rates = await rateCardFor(user.companyId, branch?.id ?? null);
  const categories = [...new Set(rates.map((r) => r.category))];
  return (
    <div>
      <PageHeader
        title="Rate card"
        subtitle={branch ? `${branch.name} market rates` : "Standard commercial rates"}
        actions={
          user.role === "ADMIN" ? (
            <Link href={branch ? `/sales/warehouses/${branch.id}/rates` : "/settings/rates"} className="btn">Edit rates</Link>
          ) : undefined
        }
      />
      {branches.length > 0 && (
        <form className="mb-4 flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-600" htmlFor="market">Market</label>
          <select className="input w-auto" id="market" name="market" defaultValue={branch?.id ?? ""}>
            <option value="">Standard rates</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button className="btn">Show</button>
        </form>
      )}
      <div className="columns-1 gap-6 lg:columns-2">
        {categories.map((category) => (
          <section key={category} className="card mb-6 break-inside-avoid">
            <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{category}</h2>
            <table className="table">
              <tbody>
                {rates
                  .filter((r) => r.category === category)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.name}
                        {r.notes && <div className="text-xs text-slate-500">{r.notes}</div>}
                      </td>
                      <td className="whitespace-nowrap text-right font-medium">
                        {formatCents(r.rateCents)} <span className="font-normal text-slate-500">/ {r.unit}</span>
                        {branch && r.rateCents !== r.standardCents && (
                          <div className="text-xs font-normal text-slate-400">Standard {formatCents(r.standardCents)}</div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      {user.company.rateCardNotes && (
        <section className="card p-4 text-sm text-slate-700">
          <h2 className="mb-2 font-semibold">Policies</h2>
          <ul className="list-disc space-y-1 pl-5">
            {user.company.rateCardNotes.split("\n").filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
