import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { limitedToOwn, quoteScope } from "@/lib/access";
import { fileKind } from "@/lib/file-upload";
import { EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { deleteQuoteDoc } from "./doc-actions";
import { QuoteDocUpload } from "./doc-upload";
import { DocTotal } from "./doc-total";
import { DocOutcome } from "./doc-outcome";
import { DocMarket } from "./doc-market";
import { DocAccount } from "./doc-account";
import { OUT_OF_MARKET, forecastByMarket } from "@/lib/market-forecast";
import { QuoteDocPreview } from "./doc-preview";
import { ReadDetails } from "./read-totals";
import { unreadDetails } from "@/lib/quote-doc-totals";

// Reading totals from earlier files runs in the request.
export const maxDuration = 60;

const TZ = "America/New_York";
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: TZ });
const dayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: TZ });
const sizeLabel = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
// When the file was made; files not read yet fall back to when they were added.
const madeOn = (d: { fileDate: Date | null; uploadedAt: Date }) => d.fileDate ?? d.uploadedAt;
const sumOf = (docs: { totalCents: number | null }[]) => docs.reduce((s, d) => s + (d.totalCents ?? 0), 0);

// Each rep's quote files, filed by the month they were added. Reps see their own; admins and
// operations see everyone's and can narrow to one rep.
const OUTCOMES: Record<string, string | null> = { open: null, won: "WON", lost: "LOST" };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ rep?: string; q?: string; status?: string; market?: string }> }) {
  const user = await requireUser();
  const own = limitedToOwn(user);
  const { rep = "", q = "", status = "", market = "" } = await searchParams;
  const outcomeFilter = status in OUTCOMES ? { outcome: OUTCOMES[status] } : {};
  const ownerFilter = own ? user.id : rep || undefined;

  const [docs, people, olderCount, unread, previewed, markets, company] = await Promise.all([
    db.quoteDoc.findMany({
      where: {
        companyId: user.companyId,
        ...(ownerFilter ? { ownerId: ownerFilter } : {}),
        ...(q.trim() ? { fileName: { contains: q.trim(), mode: "insensitive" as const } } : {}),
        ...outcomeFilter,
        ...(market === "none" ? { branchId: null, outOfMarket: false } : market === OUT_OF_MARKET ? { outOfMarket: true } : market ? { branchId: market } : {}),
      },
      select: { id: true, ownerId: true, fileName: true, size: true, uploadedAt: true, fileDate: true, branchId: true, outOfMarket: true, totalCents: true, outcome: true, emailTo: true, emailSubject: true, hubspotSentAt: true, hubspotError: true, account: { select: { id: true, name: true, hubspotId: true } } },
      orderBy: { uploadedAt: "desc" },
    }),
    db.user.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.quote.count({ where: quoteScope(user) }),
    db.quoteDoc.count({ where: unreadDetails(user.companyId, own ? user.id : undefined) }),
    db.quoteDoc
      .findMany({ where: { companyId: user.companyId, ...(ownerFilter ? { ownerId: ownerFilter } : {}), thumbnail: { not: null } }, select: { id: true } })
      .then((rows) => new Set(rows.map((r) => r.id))),
    db.branch.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.company.findUniqueOrThrow({ where: { id: user.companyId }, select: { hubspotToken: true, hubspotQuotes: true } }),
  ]);
  const hubspot = !!company.hubspotToken && company.hubspotQuotes;
  const marketName = new Map([...markets.map((m) => [m.id, m.name] as const), [OUT_OF_MARKET, "Out of market"] as const]);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const withFiles = own
    ? []
    : await db.quoteDoc.groupBy({ by: ["ownerId"], where: { companyId: user.companyId }, _count: true });
  const reps = people.filter((p) => withFiles.some((w) => w.ownerId === p.id));

  // Filed by the month each file was made, newest first.
  docs.sort((a, b) => madeOn(b).getTime() - madeOn(a).getTime());
  const months: { label: string; docs: typeof docs }[] = [];
  for (const d of docs) {
    const label = monthLabel.format(madeOn(d));
    if (months.at(-1)?.label !== label) months.push({ label, docs: [] });
    months.at(-1)!.docs.push(d);
  }

  const missing = docs.filter((d) => d.totalCents === null).length;
  const won = docs.filter((d) => d.outcome === "WON");
  const lost = docs.filter((d) => d.outcome === "LOST");
  const open = docs.filter((d) => !d.outcome);
  // Win rate counts decided proposals only: won out of won plus lost.
  const winRate = won.length + lost.length ? Math.round((100 * won.length) / (won.length + lost.length)) : null;
  const byMarket = forecastByMarket(docs.map((d) => ({ ...d, branchId: d.outOfMarket ? OUT_OF_MARKET : d.branchId })));
  const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

  return (
    <div className="space-y-6">
      <PageHeader title="Quotes" subtitle={own ? "Your quote files, filed by the month they were made" : "Every rep's quote files, filed by the month they were made"} />
      {docs.length > 0 && (
        <div className="card flex flex-wrap items-baseline gap-x-6 gap-y-1 p-5">
          <div>
            <p className="text-sm text-slate-500">Proposed revenue{q || rep || status || market ? " (filtered)" : ""}</p>
            <p className="text-2xl font-semibold tabular-nums">{money(sumOf(docs))}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Won</p>
            <p className="text-2xl font-semibold tabular-nums text-emerald-600">{money(sumOf(won))}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Win rate</p>
            <p className="text-2xl font-semibold tabular-nums">{winRate === null ? "—" : `${winRate}%`}</p>
          </div>
          <p className="text-sm text-slate-500">
            {docs.length} {docs.length === 1 ? "proposal" : "proposals"}: {won.length} won, {lost.length} lost ({money(sumOf(lost))}), {open.length} open ({money(sumOf(open))})
            {missing > 0 && <span className="text-amber-700"> · {missing} without a total, not counted</span>}
          </p>
          {unread > 0 && <ReadDetails count={unread} />}
        </div>
      )}
      {markets.length > 0 && byMarket.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Forecast by market</h2>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th className="text-right">Proposals</th>
                  <th className="text-right">Open</th>
                  <th className="text-right">Won</th>
                  <th className="text-right">Lost</th>
                  <th className="text-right">Win rate</th>
                  <th className="text-right">Forecast</th>
                </tr>
              </thead>
              <tbody>
                {byMarket.map((r) => (
                  <tr key={r.branchId ?? "none"}>
                    <td>
                      <Link href={`/sales/quotes?market=${r.branchId ?? "none"}`} className={r.branchId ? "link" : "text-amber-700 hover:underline"}>
                        {r.branchId ? marketName.get(r.branchId) ?? "Removed market" : "No market yet"}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">{r.proposals}</td>
                    <td className="text-right tabular-nums">{money(r.openCents)}</td>
                    <td className="text-right tabular-nums text-emerald-600">{money(r.wonCents)}</td>
                    <td className="text-right tabular-nums">{money(r.lostCents)}</td>
                    <td className="text-right tabular-nums" title={r.ownRate ? `${r.won} won, ${r.lost} lost here` : "Company win rate (fewer than 3 won or lost here)"}>
                      {pct(r.winRate)}{!r.ownRate && r.winRate !== null && <span className="text-slate-400">*</span>}
                    </td>
                    <td className="text-right font-semibold tabular-nums">{money(r.forecastCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Forecast is won revenue plus open proposals times the market&apos;s win rate. * Markets with fewer than 3 won or lost proposals use the company win rate.
          </p>
        </section>
      )}
      <QuoteDocUpload />

      <form className="flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" name="q" defaultValue={q} placeholder="Search file names" />
        {!own && (
          <select className="input w-auto" name="rep" defaultValue={rep}>
            <option value="">All reps</option>
            {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        {markets.length > 0 && (
          <select className="input w-auto" name="market" defaultValue={market}>
            <option value="">All markets</option>
            {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value={OUT_OF_MARKET}>Out of market</option>
            <option value="none">No market</option>
          </select>
        )}
        <select className="input w-auto" name="status" defaultValue={status}>
          <option value="">Won, lost and open</option>
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        <button className="btn">Filter</button>
        {(q || rep || status || market) && <Link href="/sales/quotes" className="text-sm text-slate-500 hover:text-slate-800">Clear</Link>}
      </form>

      {months.length === 0 ? (
        <div className="card">
          <EmptyState>{q || rep || status || market ? "No files match." : own ? "No quotes yet. Add your first files above." : "No quote files yet."}</EmptyState>
        </div>
      ) : (
        months.map((m) => (
          <section key={m.label} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {m.label}{" "}
              <span className="font-normal normal-case tracking-normal">
                · {m.docs.length} {m.docs.length === 1 ? "file" : "files"} · {money(sumOf(m.docs))}
              </span>
            </h2>
            <div className="card overflow-x-auto">
              <table className="table">
                <tbody>
                  {m.docs.map((d) => (
                    <tr key={d.id}>
                      <td className="w-20 align-top">
                        <QuoteDocPreview
                          id={d.id}
                          fileName={d.fileName}
                          kind={fileKind(d.fileName)}
                          saved={previewed.has(d.id)}
                          canEdit={d.ownerId === user.id || user.role === "ADMIN"}
                        />
                      </td>
                      <td className="min-w-0">
                        <a href={`/quote-doc/${d.id}`} className="link break-all">{d.fileName}</a>
                        <span className="ml-2 text-xs text-slate-500">{fileKind(d.fileName)} · {sizeLabel(d.size)}</span>
                        {d.emailTo && (
                          <span className="block text-xs text-slate-500" title={d.emailSubject ?? undefined}>
                            Emailed to {d.emailTo}
                          </span>
                        )}
                        <DocAccount
                          id={d.id}
                          account={d.account && { id: d.account.id, name: d.account.name, inHubSpot: !!d.account.hubspotId }}
                          sent={!!d.hubspotSentAt}
                          error={d.hubspotError}
                          hubspot={hubspot}
                          canEdit={d.ownerId === user.id || user.role === "ADMIN"}
                        />
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <DocTotal id={d.id} cents={d.totalCents} canEdit={d.ownerId === user.id || user.role === "ADMIN"} />
                      </td>
                      <td className="whitespace-nowrap">
                        <DocMarket id={d.id} branchId={d.outOfMarket ? OUT_OF_MARKET : d.branchId} markets={markets} canEdit={d.ownerId === user.id || user.role === "ADMIN"} />
                      </td>
                      <td className="whitespace-nowrap">
                        <DocOutcome id={d.id} outcome={d.outcome} canEdit={d.ownerId === user.id || user.role === "ADMIN"} />
                      </td>
                      {!own && <td className="whitespace-nowrap text-slate-600">{nameOf.get(d.ownerId) ?? "Former teammate"}</td>}
                      <td className="whitespace-nowrap text-slate-500" title={`Added ${dayLabel.format(d.uploadedAt)}`}>{dayLabel.format(madeOn(d))}</td>
                      <td className="text-right">
                        {(d.ownerId === user.id || user.role === "ADMIN") && (
                          <ConfirmButton
                            action={deleteQuoteDoc.bind(null, d.id)}
                            label="Remove"
                            confirmText={`Remove ${d.fileName}?`}
                            className="text-sm text-slate-400 hover:text-red-600"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {olderCount > 0 && (
        <p className="text-sm text-slate-500">
          <Link href="/sales/quotes/older" className="link">Older quotes built in Mothership ({olderCount})</Link>
        </p>
      )}
    </div>
  );
}
