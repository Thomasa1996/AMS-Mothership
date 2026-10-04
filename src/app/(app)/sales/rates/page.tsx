import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/quote-math";
import { PageHeader } from "@/components/ui";

export default async function RateCardPage() {
  const user = await requireUser();
  const rates = await db.rateItem.findMany({
    where: { companyId: user.companyId, active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  const categories = [...new Set(rates.map((r) => r.category))];
  return (
    <div>
      <PageHeader
        title="Rate card"
        subtitle="Standard commercial rates"
        actions={user.role === "ADMIN" ? <Link href="/settings/rates" className="btn">Edit rates</Link> : undefined}
      />
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
