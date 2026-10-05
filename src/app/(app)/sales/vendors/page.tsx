import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui";
import { MISSING_COMPANY } from "@/lib/constants";
import { VerificationBadge } from "./status-badge";
import { GradeBadge } from "./grade-badge";
import { GRADES, GRADE_FLOOR, summarize, type Grade } from "@/lib/vendor-grade";

type Search = { q?: string; category?: string; state?: string; status?: string; grade?: string; sort?: string };

export default async function VendorsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const { q = "", category = "", state = "", status = "", grade = "", sort = "" } = await searchParams;

  const where = {
    companyId: user.companyId,
    ...(category ? { category } : {}),
    ...(state ? { state } : {}),
    ...(status ? { verificationStatus: status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { contactName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { address: { contains: q, mode: "insensitive" as const } },
            { markets: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [allVendors, categories, states, statuses, total, ratings] = await Promise.all([
    db.vendor.findMany({ where, orderBy: [{ category: "asc" }, { position: "asc" }, { name: "asc" }] }),
    db.vendor.groupBy({ by: ["category"], where: { companyId: user.companyId }, _count: true, orderBy: { category: "asc" } }),
    db.vendor.groupBy({ by: ["state"], where: { companyId: user.companyId, state: { not: null } }, orderBy: { state: "asc" } }),
    db.vendor.groupBy({
      by: ["verificationStatus"],
      where: { companyId: user.companyId, verificationStatus: { not: null } },
      orderBy: { verificationStatus: "asc" },
    }),
    db.vendor.count({ where: { companyId: user.companyId } }),
    db.vendorRating.findMany({
      where: { companyId: user.companyId },
      select: { vendorId: true, quality: true, timeliness: true, pricing: true, communication: true },
    }),
  ]);

  const byVendor = new Map<string, typeof ratings>();
  for (const r of ratings) byVendor.set(r.vendorId, [...(byVendor.get(r.vendorId) ?? []), r]);
  const scores = new Map([...byVendor].map(([id, rs]) => [id, summarize(rs)!]));
  const gradeFilter = (GRADES as readonly string[]).includes(grade) ? (grade as Grade) : null;
  let vendors = allVendors;
  if (grade === "none") vendors = vendors.filter((v) => !scores.has(v.id));
  else if (gradeFilter) vendors = vendors.filter((v) => (scores.get(v.id)?.average ?? -1) >= GRADE_FLOOR[gradeFilter]);
  if (sort === "grade") {
    // Best graded first; unrated vendors keep their file order at the end.
    vendors = [...vendors].sort((a, b) => (scores.get(b.id)?.average ?? -1) - (scores.get(a.id)?.average ?? -1));
  }

  const link = (next: Partial<Search>) => {
    const params = new URLSearchParams({ q, category, state, status, grade, sort, ...next } as Record<string, string>);
    for (const [k, v] of [...params.entries()]) if (!v) params.delete(k);
    const s = params.toString();
    return `/sales/vendors${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle={`${vendors.length} of ${total} vendor contacts${category ? ` in ${category}` : ""}`}
        actions={
          <>
            {user.role === "ADMIN" && <Link href="/sales/vendors/import" className="btn">Import from Excel</Link>}
            <Link href="/sales/vendors/new" className="btn btn-primary">Add vendor</Link>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="card h-fit p-2">
          <Link
            href={link({ category: "" })}
            className={`flex justify-between rounded px-2 py-1.5 text-sm ${!category ? "bg-brand-50 font-medium text-brand-700" : "hover:bg-slate-50"}`}
          >
            All categories <span className="text-slate-400">{total}</span>
          </Link>
          {categories.map((c) => (
            <Link
              key={c.category}
              href={link({ category: c.category })}
              className={`flex justify-between gap-2 rounded px-2 py-1.5 text-sm ${
                category === c.category ? "bg-brand-50 font-medium text-brand-700" : "hover:bg-slate-50"
              }`}
            >
              <span className="truncate">{c.category}</span> <span className="text-slate-400">{c._count}</span>
            </Link>
          ))}
        </aside>
        <div className="min-w-0">
          <form className="mb-4 flex flex-wrap gap-2">
            {category && <input type="hidden" name="category" value={category} />}
            <input className="input max-w-xs" name="q" defaultValue={q} placeholder="Search name, contact, email, market" />
            <select className="input w-auto" name="state" defaultValue={state}>
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s.state} value={s.state ?? ""}>{s.state}</option>
              ))}
            </select>
            <select className="input w-auto max-w-56" name="status" defaultValue={status}>
              <option value="">Any verification status</option>
              {statuses.map((s) => (
                <option key={s.verificationStatus} value={s.verificationStatus ?? ""}>{s.verificationStatus}</option>
              ))}
            </select>
            <select className="input w-auto" name="grade" defaultValue={grade}>
              <option value="">Any grade</option>
              <option value="A">A only</option>
              <option value="B">B or better</option>
              <option value="C">C or better</option>
              <option value="D">D or better</option>
              <option value="none">Not rated yet</option>
            </select>
            <select className="input w-auto" name="sort" defaultValue={sort}>
              <option value="">File order</option>
              <option value="grade">Best grade first</option>
            </select>
            <button className="btn">Filter</button>
            {(q || state || status || grade || sort) && (
              <Link href={link({ q: "", state: "", status: "", grade: "", sort: "" })} className="btn">Clear</Link>
            )}
          </form>
          <div className="card overflow-x-auto">
            {vendors.length === 0 ? (
              <EmptyState>
                {total === 0 ? "No vendors yet. Import your vendor file or add one." : "No vendors match these filters."}
              </EmptyState>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    {!category && <th>Category</th>}
                    <th>State</th>
                    <th>Contact</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.id} className="align-top hover:bg-slate-50">
                      <td className="min-w-48">
                        <Link href={`/sales/vendors/${v.id}`} className={v.name === MISSING_COMPANY ? "font-medium italic text-amber-700 hover:underline" : "link"}>
                          {v.name}
                        </Link>
                        {v.markets && <div className="text-xs text-slate-500">{v.markets}</div>}
                      </td>
                      {!category && <td className="whitespace-nowrap text-slate-600">{v.category}</td>}
                      <td>{v.state}</td>
                      <td className="min-w-36">{v.contactName}</td>
                      <td className="whitespace-nowrap">{v.phone}</td>
                      <td>{v.email && <a href={`mailto:${v.email}`} className="text-brand-600 hover:underline">{v.email}</a>}</td>
                      <td><VerificationBadge status={v.verificationStatus} /></td>
                      <td className="whitespace-nowrap">
                        {(() => {
                          const sc = scores.get(v.id);
                          return (
                            <span className="flex items-center gap-1.5">
                              <GradeBadge grade={sc?.grade ?? null} title={sc ? `${sc.average.toFixed(1)} of 5` : undefined} />
                              {sc && <span className="text-xs text-slate-500">({sc.count})</span>}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
