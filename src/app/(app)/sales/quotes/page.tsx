import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { limitedToOwn, quoteScope } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { QUOTE_STATUSES, formatCents } from "@/lib/quote-math";
import { EmptyState, PageHeader } from "@/components/ui";
import { QuoteStatusBadge } from "./status";

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; mine?: string }> }) {
  const user = await requireUser();
  const { q = "", status = "", mine = "" } = await searchParams;

  const [quotes, totals] = await Promise.all([
    db.quote.findMany({
      where: {
        ...quoteScope(user),
        ...(status ? { status } : {}),
        ...(mine ? { createdById: user.id } : {}),
        ...(q
          ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { project: { name: { contains: q, mode: "insensitive" as const } } }, { project: { account: { name: { contains: q, mode: "insensitive" as const } } } }] }
          : {}),
      },
      include: {
        project: { select: { id: true, name: true, account: { select: { id: true, name: true } } } },
        createdBy: { select: { name: true } },
      },
      orderBy: { number: "desc" },
    }),
    db.quote.groupBy({ by: ["status"], where: quoteScope(user), _sum: { totalCents: true }, _count: true }),
  ]);
  const byStatus = Object.fromEntries(totals.map((t) => [t.status, t]));

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle="Every proposal the team has written, in one place"
        actions={
          <div className="flex gap-2">
            <Link href="/sales/quotes/upload" className="btn">Upload PDF quote</Link>
            <Link href="/sales/quotes/new" className="btn btn-primary">New quote</Link>
          </div>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {QUOTE_STATUSES.map((s) => (
          <Link
            key={s.id}
            href={status === s.id ? "/sales/quotes" : `/sales/quotes?status=${s.id}`}
            className={`card p-4 hover:border-brand-500 ${status === s.id ? "border-brand-500 ring-1 ring-brand-500" : ""}`}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</div>
            <div className="mt-1 text-xl font-semibold">{formatCents(byStatus[s.id]?._sum.totalCents ?? 0)}</div>
            <div className="text-xs text-slate-500">{byStatus[s.id]?._count ?? 0} quotes</div>
          </Link>
        ))}
      </div>
      <form className="mb-4 flex flex-wrap items-center gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input className="input max-w-xs" name="q" defaultValue={q} placeholder="Search quotes, projects, companies" />
        {!limitedToOwn(user) && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mine" value="1" defaultChecked={!!mine} /> Only mine
          </label>
        )}
        <button className="btn">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        {quotes.length === 0 ? (
          <EmptyState>No quotes yet. Start one from a project or with New quote.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Quote</th>
                <th>Company</th>
                <th>Status</th>
                <th>Date</th>
                <th>Prepared by</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-slate-50">
                  <td className="text-slate-500">{quote.number}</td>
                  <td>
                    <Link href={`/sales/quotes/${quote.id}`} className="link">{quote.title}</Link>
                    {quote.uploaded && <span className="badge ml-2 bg-slate-100 text-slate-600" title="Written in Word and uploaded">PDF</span>}
                    <div className="text-xs text-slate-500">{quote.project.name}</div>
                  </td>
                  <td>
                    <Link href={`/crm/accounts/${quote.project.account.id}`} className="text-slate-700 hover:underline">{quote.project.account.name}</Link>
                  </td>
                  <td><QuoteStatusBadge status={quote.status} /></td>
                  <td className="whitespace-nowrap">{formatDate(quote.quoteDate)}</td>
                  <td>{quote.createdBy.name}</td>
                  <td className="text-right font-medium">{formatCents(quote.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
