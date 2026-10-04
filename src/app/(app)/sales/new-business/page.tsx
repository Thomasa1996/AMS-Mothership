import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { accountScope } from "@/lib/access";
import { EmptyState, PageHeader } from "@/components/ui";
import { ApolloError, COMPANY_SIZES, PER_PAGE, SENIORITIES, searchPeople, splitList, type ApolloSearchPerson } from "@/lib/apollo";
import { apolloKeyFor } from "@/lib/apollo-company";
import { AddToCrm } from "./add-button";

type Search = { q?: string; titles?: string; where?: string; hq?: string; level?: string | string[]; size?: string | string[]; page?: string };

const asList = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function NewBusinessPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const key = await apolloKeyFor(user.companyId);

  if (!key) {
    return (
      <div>
        <PageHeader title="New Business Development" subtitle="Find new prospects in Apollo and add them to the CRM" />
        <div className="card">
          <EmptyState>
            Apollo isn&apos;t connected yet.{" "}
            {user.role === "ADMIN" ? (
              <Link href="/settings/apollo" className="link">Connect it in Settings</Link>
            ) : (
              "Ask an admin to connect it in Settings, Apollo."
            )}
          </EmptyState>
        </div>
      </div>
    );
  }

  const search = {
    keywords: sp.q?.trim() || undefined,
    titles: splitList(sp.titles),
    personLocations: splitList(sp.where),
    companyLocations: splitList(sp.hq),
    seniorities: asList(sp.level).filter((l) => SENIORITIES.some((s) => s.id === l)),
    sizes: asList(sp.size).filter((l) => COMPANY_SIZES.some((s) => s.id === l)),
    page: Math.min(Math.max(1, Number(sp.page) || 1), 500),
  };
  const searched = !!(search.keywords || search.titles.length || search.personLocations.length || search.companyLocations.length || search.seniorities.length || search.sizes.length);

  let people: ApolloSearchPerson[] = [];
  let total = 0;
  let error: string | null = null;
  if (searched) {
    try {
      ({ people, total } = await searchPeople(key, search));
    } catch (e) {
      error = e instanceof ApolloError ? e.message : "Couldn't search Apollo. Try again.";
    }
  }

  // People already added from Apollo, so their row shows where they went instead of an Add button.
  const added = people.length
    ? await db.contact.findMany({
        where: { companyId: user.companyId, apolloId: { in: people.map((p) => p.id) } },
        select: { apolloId: true, account: { select: { id: true, name: true, ownerId: true } } },
      })
    : [];
  const addedById = new Map(added.map((c) => [c.apolloId!, c.account]));
  const visible = new Set(
    (await db.account.findMany({ where: { ...accountScope(user), id: { in: added.map((c) => c.account.id) } }, select: { id: true } })).map((a) => a.id),
  );
  const canOpenAll = user.role !== "SALES";

  const pages = Math.min(500, Math.ceil(total / PER_PAGE));
  const pageLink = (page: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== "page") asList(v).forEach((item) => q.append(k, item));
    q.set("page", String(page));
    return `/sales/new-business?${q}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="New Business Development" subtitle="Find new prospects in Apollo and add them to the CRM. Searching is free; adding someone uses 1 Apollo credit." />

      <form className="card grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label" htmlFor="titles">Job titles</label>
          <input className="input" id="titles" name="titles" defaultValue={sp.titles} placeholder="Facilities Manager, Office Manager" />
        </div>
        <div>
          <label className="label" htmlFor="where">Where they work</label>
          <input className="input" id="where" name="where" defaultValue={sp.where} placeholder="Virginia, Washington DC" />
        </div>
        <div>
          <label className="label" htmlFor="hq">Company headquarters</label>
          <input className="input" id="hq" name="hq" defaultValue={sp.hq} placeholder="Any" />
        </div>
        <div>
          <label className="label" htmlFor="q">Keywords</label>
          <input className="input" id="q" name="q" defaultValue={sp.q} placeholder="Company name, industry, person" />
        </div>
        <fieldset>
          <legend className="label">Seniority</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            {SENIORITIES.map((s) => (
              <label key={s.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="level" value={s.id} defaultChecked={search.seniorities.includes(s.id)} />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Company size (employees)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            {COMPANY_SIZES.map((s) => (
              <label key={s.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="size" value={s.id} defaultChecked={search.sizes.includes(s.id)} />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-3 md:col-span-2 lg:col-span-3">
          <button className="btn btn-primary">Search Apollo</button>
          {searched && <Link href="/sales/new-business" className="text-sm text-slate-500 hover:text-slate-800">Clear</Link>}
          <span className="text-xs text-slate-500">Separate several titles or places with commas.</span>
        </div>
      </form>

      {error && <div className="card p-4 text-sm text-red-600">{error}</div>}

      {searched && !error && (
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{total.toLocaleString()} people match{total > PER_PAGE ? `, page ${search.page} of ${pages.toLocaleString()}` : ""}</span>
            <span className="hidden sm:inline">Last names show in full once added</span>
          </div>
          {people.length === 0 ? (
            <EmptyState>No one matches. Try fewer filters or broader titles.</EmptyState>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Company</th>
                  <th className="text-right">CRM</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const account = addedById.get(p.id);
                  return (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap font-medium">{[p.first_name, p.last_name ?? p.last_name_obfuscated].filter(Boolean).join(" ") || "Name hidden"}</td>
                      <td>{p.title ?? <span className="text-slate-400">None listed</span>}</td>
                      <td>{p.organization?.name ?? <span className="text-slate-400">None listed</span>}</td>
                      <td className="text-right">
                        {account ? (
                          canOpenAll || visible.has(account.id) ? (
                            <Link href={`/crm/accounts/${account.id}`} className="link whitespace-nowrap text-sm">In CRM: {account.name}</Link>
                          ) : (
                            <span className="whitespace-nowrap text-sm text-slate-500">In CRM: {account.name}</span>
                          )
                        ) : (
                          <AddToCrm apolloId={p.id} canOpen={canOpenAll} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
              {search.page > 1 ? <Link href={pageLink(search.page - 1)} className="link">Previous</Link> : <span />}
              {search.page < pages ? <Link href={pageLink(search.page + 1)} className="link">Next</Link> : <span />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
