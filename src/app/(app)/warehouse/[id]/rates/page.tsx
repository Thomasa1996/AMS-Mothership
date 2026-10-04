import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { rateCardFor } from "@/lib/branches";
import { formatCents } from "@/lib/quote-math";
import { PageHeader } from "@/components/ui";
import { repriceMarket, saveMarketRates } from "../../actions";
import { MarketRatesForm, RepriceForm } from "../../forms";

const pct = (factor: number) => Math.round((factor - 1) * 1000) / 10;

export default async function EditMarketRatesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (user.role !== "ADMIN") redirect(`/warehouse/${id}`);
  const branch = await db.branch.findFirst({ where: { id, companyId: user.companyId } });
  if (!branch) notFound();
  const rates = await rateCardFor(user.companyId, branch.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/warehouse/${branch.id}`} className="text-sm text-slate-500 hover:text-slate-700">&larr; {branch.name}</Link>
        <PageHeader title={`${branch.name} market rates`} subtitle="Quotes written for this market use these prices." />
      </div>
      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Adjust the whole market</h2>
        <p className="text-sm text-slate-600">
          Sets labor, crew, IT and delivery rates, and storage rates, to a percentage of the standard card and reprices them all.
          Materials, rentals, disposal and fees stay at the standard price. This replaces any prices edited below.
        </p>
        <RepriceForm action={repriceMarket.bind(null, branch.id)} labor={pct(branch.laborFactor)} storage={pct(branch.storageFactor)} />
        {branch.marketNotes && <p className="whitespace-pre-line text-xs text-slate-500">{branch.marketNotes}</p>}
      </section>
      <MarketRatesForm
        key={branch.updatedAt.getTime()}
        action={saveMarketRates.bind(null, branch.id)}
        rates={rates.map((r) => ({
          id: r.id,
          category: r.category,
          name: r.name,
          unit: r.unit,
          standard: formatCents(r.standardCents),
          rate: (r.rateCents / 100).toFixed(2),
        }))}
      />
    </div>
  );
}
