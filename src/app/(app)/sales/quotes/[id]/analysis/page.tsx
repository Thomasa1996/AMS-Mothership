import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { quoteScope } from "@/lib/access";
import { formatCents, quoteTotalCents } from "@/lib/quote-math";
import { analyzePlan, materialsCents, readPlan } from "@/lib/quote-plan";

// Internal cost analysis for a quote: blended rate per man, load-and-go cost per truckload and
// all-in cost per truckload, by day. Never shown to the client.
export default async function QuoteAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const quote = await db.quote.findFirst({ where: { id, ...quoteScope(user) }, include: { lines: true } });
  if (!quote) notFound();
  const plan = readPlan(quote.plan);
  const otherCents = quoteTotalCents(quote.lines);
  const a = analyzePlan(plan, otherCents);
  const money = (c: number | null) => (c == null ? "—" : formatCents(c));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Cost analysis: quote #{quote.number}</h1>
          <p className="mt-1 text-sm text-slate-500">{quote.title} · internal only, not part of the proposal</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/sales/quotes/${quote.id}`} className="btn">Back to quote</Link>
          <Link href={`/sales/quotes/${quote.id}/edit`} className="btn">Edit quote</Link>
        </div>
      </div>

      {plan.days.length === 0 ? (
        <div className="card p-6 text-sm text-slate-600">This quote has no day-by-day schedule yet. Add days with crew in the quote builder to see the analysis.</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Blended rate per man" value={`${formatCents(a.blendedRateCents)}/hr`} />
            <Stat label="Labor" value={formatCents(a.totalLaborCents)} sub={`${a.manHours} man-hours`} />
            <Stat label="Materials and other lines" value={formatCents(a.overheadCents)} sub={`materials ${formatCents(materialsCents(plan.materials))}`} />
            <Stat label="All-in per truckload" value={money(a.allInPerTruckCents)} sub={a.loads ? `${a.loads} truckloads` : "enter truckloads per day"} />
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="table min-w-[900px]">
              <thead>
                <tr>
                  <th>Day</th>
                  <th className="text-right">Crew</th>
                  <th className="text-right">Crew rate</th>
                  <th className="text-right">Blended / man</th>
                  <th className="text-right">Man-hours</th>
                  <th className="text-right">Labor</th>
                  <th className="text-right">Truckloads</th>
                  <th className="text-right">Load &amp; go / truck</th>
                  <th className="text-right">All-in / truck</th>
                </tr>
              </thead>
              <tbody>
                {a.days.map((d, i) => (
                  <tr key={i}>
                    <td>{d.name}</td>
                    <td className="text-right">{d.people}</td>
                    <td className="text-right">{formatCents(d.crewRateCents)}/hr</td>
                    <td className="text-right">{formatCents(d.blendedRateCents)}/hr</td>
                    <td className="text-right">{d.manHours}</td>
                    <td className="text-right">{formatCents(d.laborCents)}</td>
                    <td className="text-right">{d.loads || "—"}</td>
                    <td className="text-right">{money(d.loadAndGoPerTruckCents)}</td>
                    <td className="text-right">{money(d.allInPerTruckCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td>Total</td>
                  <td />
                  <td />
                  <td className="text-right">{formatCents(a.blendedRateCents)}/hr</td>
                  <td className="text-right">{a.manHours}</td>
                  <td className="text-right">{formatCents(a.totalLaborCents)}</td>
                  <td className="text-right">{a.loads || "—"}</td>
                  <td />
                  <td className="text-right">{money(a.allInPerTruckCents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="card space-y-1 p-5 text-sm text-slate-600">
            <p><strong>Blended rate per man:</strong> the crew&rsquo;s hourly rate divided by the number of people on it.</p>
            <p><strong>Load &amp; go per truck:</strong> trucks, drivers and movers only (no supervisors, project managers or installers) for the day&rsquo;s hours, divided by the day&rsquo;s truckloads.</p>
            <p><strong>All-in per truck:</strong> the day&rsquo;s labor plus its share of materials and other price lines (spread by labor), divided by its truckloads.</p>
            <p>Quote total: <strong>{formatCents(quote.totalCents)}</strong></p>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
