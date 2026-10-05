import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { accountScope } from "@/lib/access";
import { EmptyState, PageHeader } from "@/components/ui";

const PAGE_SIZE = 100;

// Everyone's contacts across the accounts this person can see. Contacts are added and edited on
// their account's page.
export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await requireUser();
  const { q = "", page: pageParam = "1" } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);
  const term = q.trim();
  const where = {
    companyId: user.companyId,
    account: accountScope(user),
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" as const } },
            { email: { contains: term, mode: "insensitive" as const } },
            { title: { contains: term, mode: "insensitive" as const } },
            { phone: { contains: term } },
            { account: { name: { contains: term, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const [contacts, total] = await Promise.all([
    db.contact.findMany({
      where,
      include: { account: { select: { id: true, name: true } } },
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.contact.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => `/crm/contacts?${new URLSearchParams({ ...(term ? { q: term } : {}), page: String(n) })}`;

  return (
    <div>
      <PageHeader title="Contacts" subtitle={`${total} ${total === 1 ? "contact" : "contacts"}. Add or edit them on their account's page.`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-sm" name="q" defaultValue={term} placeholder="Search name, email, title, phone or account" />
        <button className="btn">Search</button>
      </form>
      <div className="card overflow-x-auto">
        {contacts.length === 0 ? (
          <EmptyState>{term ? "No contacts match." : "No contacts yet. Add them from an account's page."}</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Title</th><th>Account</th><th>Email</th><th>Phone</th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">
                    {c.name}
                    {c.isPrimary && <span className="badge ml-2 bg-brand-50 text-brand-700">Primary</span>}
                  </td>
                  <td className="text-slate-600">{c.title}</td>
                  <td><Link href={`/crm/accounts/${c.account.id}`} className="link">{c.account.name}</Link></td>
                  <td>{c.email && <a href={`mailto:${c.email}`} className="text-slate-700 hover:underline">{c.email}</a>}</td>
                  <td className="whitespace-nowrap">{c.phone && <a href={`tel:${c.phone}`} className="text-slate-700 hover:underline">{c.phone}</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          {page > 1 && <Link href={pageHref(page - 1)} className="btn">Previous</Link>}
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page < pages && <Link href={pageHref(page + 1)} className="btn">Next</Link>}
        </div>
      )}
    </div>
  );
}
