import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { limitedToOwn, quoteScope } from "@/lib/access";
import { fileKind } from "@/lib/file-upload";
import { EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { deleteQuoteDoc } from "./doc-actions";
import { QuoteDocUpload } from "./doc-upload";

const TZ = "America/New_York";
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: TZ });
const dayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: TZ });
const sizeLabel = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;

// Each rep's quote files, filed by the month they were added. Reps see their own; admins and
// operations see everyone's and can narrow to one rep.
export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ rep?: string; q?: string }> }) {
  const user = await requireUser();
  const own = limitedToOwn(user);
  const { rep = "", q = "" } = await searchParams;
  const ownerFilter = own ? user.id : rep || undefined;

  const [docs, people, olderCount] = await Promise.all([
    db.quoteDoc.findMany({
      where: {
        companyId: user.companyId,
        ...(ownerFilter ? { ownerId: ownerFilter } : {}),
        ...(q.trim() ? { fileName: { contains: q.trim(), mode: "insensitive" as const } } : {}),
      },
      select: { id: true, ownerId: true, fileName: true, size: true, uploadedAt: true },
      orderBy: { uploadedAt: "desc" },
    }),
    db.user.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.quote.count({ where: quoteScope(user) }),
  ]);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const withFiles = own
    ? []
    : await db.quoteDoc.groupBy({ by: ["ownerId"], where: { companyId: user.companyId }, _count: true });
  const reps = people.filter((p) => withFiles.some((w) => w.ownerId === p.id));

  const months: { label: string; docs: typeof docs }[] = [];
  for (const d of docs) {
    const label = monthLabel.format(d.uploadedAt);
    if (months.at(-1)?.label !== label) months.push({ label, docs: [] });
    months.at(-1)!.docs.push(d);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Quotes" subtitle={own ? "Your quote files, filed by month" : "Every rep's quote files, filed by month"} />
      <QuoteDocUpload />

      <form className="flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" name="q" defaultValue={q} placeholder="Search file names" />
        {!own && (
          <select className="input w-auto" name="rep" defaultValue={rep}>
            <option value="">All reps</option>
            {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <button className="btn">Filter</button>
        {(q || rep) && <Link href="/sales/quotes" className="text-sm text-slate-500 hover:text-slate-800">Clear</Link>}
      </form>

      {months.length === 0 ? (
        <div className="card">
          <EmptyState>{q || rep ? "No files match." : own ? "No quotes yet. Add your first files above." : "No quote files yet."}</EmptyState>
        </div>
      ) : (
        months.map((m) => (
          <section key={m.label} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {m.label} <span className="font-normal normal-case tracking-normal">· {m.docs.length} {m.docs.length === 1 ? "file" : "files"}</span>
            </h2>
            <div className="card overflow-x-auto">
              <table className="table">
                <tbody>
                  {m.docs.map((d) => (
                    <tr key={d.id}>
                      <td className="min-w-0">
                        <a href={`/quote-doc/${d.id}`} className="link break-all">{d.fileName}</a>
                        <span className="ml-2 text-xs text-slate-500">{fileKind(d.fileName)} · {sizeLabel(d.size)}</span>
                      </td>
                      {!own && <td className="whitespace-nowrap text-slate-600">{nameOf.get(d.ownerId) ?? "Former teammate"}</td>}
                      <td className="whitespace-nowrap text-slate-500">{dayLabel.format(d.uploadedAt)}</td>
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
