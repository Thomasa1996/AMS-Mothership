import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/ui";
import { ApolloError, COMPANY_SIZES, PAGE_SIZES, SENIORITIES, parseMoney, searchPeople, splitList, type ApolloSearchPerson } from "@/lib/apollo";
import { apolloKeyFor } from "@/lib/apollo-company";
import { listScope } from "@/lib/prospect-lists";
import { crmStatus } from "./crm-status";
import { ResultsTable } from "./results-table";

type Search = {
  q?: string;
  titles?: string;
  exact?: string;
  where?: string;
  hq?: string;
  level?: string | string[];
  size?: string | string[];
  industry?: string;
  domains?: string;
  revmin?: string;
  revmax?: string;
  verified?: string;
  per?: string;
  page?: string;
};

const asList = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function NewBusinessPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const key = await apolloKeyFor(user.companyId);

  if (!key) {
    return (
      <div className="card">
        <EmptyState>
          Apollo isn&apos;t connected yet.{" "}
          {user.role === "ADMIN" ? <Link href="/settings/apollo" className="link">Connect it in Settings</Link> : "Ask an admin to connect it in Settings, Apollo."}
        </EmptyState>
      </div>
    );
  }

  const perPage = PAGE_SIZES.find((n) => String(n) === sp.per) ?? PAGE_SIZES[0];
  const search = {
    keywords: sp.q?.trim() || undefined,
    titles: splitList(sp.titles),
    exactTitles: sp.exact === "on",
    personLocations: splitList(sp.where),
    companyLocations: splitList(sp.hq),
    seniorities: asList(sp.level).filter((l) => SENIORITIES.some((s) => s.id === l)),
    sizes: asList(sp.size).filter((l) => COMPANY_SIZES.some((s) => s.id === l)),
    industries: splitList(sp.industry),
    domains: splitList(sp.domains).map((d) => d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")),
    revenueMin: parseMoney(sp.revmin),
    revenueMax: parseMoney(sp.revmax),
    verifiedEmail: sp.verified === "on",
    perPage,
    page: 1,
  };
  // Apollo shows at most 50,000 results, so the last page depends on the page size.
  const maxPage = Math.floor(50000 / perPage);
  search.page = Math.min(Math.max(1, Number(sp.page) || 1), maxPage);
  const searched = !!(
    search.keywords ||
    search.titles.length ||
    search.personLocations.length ||
    search.companyLocations.length ||
    search.seniorities.length ||
    search.sizes.length ||
    search.industries.length ||
    search.domains.length ||
    search.revenueMin ||
    search.revenueMax
  );
  const advancedUsed = !!(search.industries.length || search.domains.length || search.revenueMin || search.revenueMax || search.verifiedEmail || search.exactTitles || sp.per);

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

  const [status, lists] = await Promise.all([
    crmStatus(user, people.map((p) => p.id)),
    db.prospectList.findMany({ where: { ...listScope(user), ownerId: user.id }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" } }),
  ]);

  const pages = Math.min(maxPage, Math.ceil(total / perPage));
  const pageLink = (page: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== "page") asList(v).forEach((item) => q.append(k, item));
    q.set("page", String(page));
    return `/sales/new-business?${q}`;
  };

  return (
    <div className="space-y-5">
      <form className="card space-y-4 p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="titles">Job titles</label>
            <input className="input" id="titles" name="titles" defaultValue={sp.titles} placeholder="Facilities Manager, Office Manager" />
            <label className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" name="exact" defaultChecked={search.exactTitles} /> Exact titles only
            </label>
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
            <label className="label" htmlFor="industry">Industry or company type</label>
            <input className="input" id="industry" name="industry" defaultValue={sp.industry} placeholder="Government contractor, healthcare, law firm" />
          </div>
          <div>
            <label className="label" htmlFor="q">Keywords</label>
            <input className="input" id="q" name="q" defaultValue={sp.q} placeholder="Company name, person, anything" />
          </div>
          <div>
            <label className="label" htmlFor="domains">Company websites</label>
            <input className="input" id="domains" name="domains" defaultValue={sp.domains} placeholder="leidos.com, saic.com" />
          </div>
          <fieldset className="md:col-span-2 lg:col-span-3">
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
          <fieldset className="md:col-span-2 lg:col-span-3">
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
        </div>
        <details open={advancedUsed} className="rounded-md border border-slate-200 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">More filters</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label" htmlFor="revmin">Company revenue from</label>
              <input className="input" id="revmin" name="revmin" defaultValue={sp.revmin} placeholder="$5M" />
            </div>
            <div>
              <label className="label" htmlFor="revmax">Company revenue up to</label>
              <input className="input" id="revmax" name="revmax" defaultValue={sp.revmax} placeholder="$500M" />
            </div>
            <div>
              <label className="label" htmlFor="per">Results per page</label>
              <select className="input" id="per" name="per" defaultValue={String(perPage)}>
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" name="verified" defaultChecked={search.verifiedEmail} /> Only people with a verified email
            </label>
          </div>
        </details>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary">Search Apollo</button>
          {searched && <Link href="/sales/new-business" className="text-sm text-slate-500 hover:text-slate-800">Clear</Link>}
          <span className="text-xs text-slate-500">Separate several values with commas.</span>
        </div>
      </form>

      {error && <div className="card p-4 text-sm text-red-600">{error}</div>}

      {searched && !error && (
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between px-4 pt-3 text-sm text-slate-500">
            <span>{total.toLocaleString()} people match{total > perPage ? `, page ${search.page} of ${pages.toLocaleString()}` : ""}</span>
            <span className="hidden sm:inline">Last names show in full once added to the CRM</span>
          </div>
          {people.length === 0 ? (
            <EmptyState>No one matches. Try fewer filters or broader titles.</EmptyState>
          ) : (
            <ResultsTable
              rows={people.map((p) => {
                const s = status.get(p.id);
                return {
                  apolloId: p.id,
                  firstName: p.first_name,
                  lastName: p.last_name ?? p.last_name_obfuscated ?? null,
                  title: p.title,
                  companyName: p.organization?.name ?? null,
                  inCrm: s ? { id: s.id, name: s.name, canOpen: s.canOpen } : null,
                };
              })}
              lists={lists}
              canOpenAll={user.role !== "SALES"}
            />
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
