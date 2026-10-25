import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { signedDocScope } from "@/lib/access";
import { signDate } from "@/lib/sign-layout";
import { EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { deleteSignedDocument } from "./actions";
import { SignatureCard } from "./signature";
import { DocumentSigner } from "./signer";

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

// Sign agreements as the company: save a signature once, drop in a PDF, place the signature with your
// name, title, company and the date, and download the signed copy. Signed copies are kept here.
export default async function SignDocumentsPage() {
  const user = await requireUser();
  const docs = await db.signedDocument.findMany({
    where: signedDocScope(user),
    select: { id: true, fileName: true, size: true, signerName: true, signedById: true, signedAt: true },
    orderBy: { signedAt: "desc" },
    take: 200,
  });
  const showSigner = docs.some((d) => d.signedById !== user.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Sign documents" subtitle="Sign an agreement or form as the company and download the signed PDF" />
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Your signature</h2>
        <SignatureCard current={user.signature} />
      </section>
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Sign a PDF</h2>
        <DocumentSigner
          signature={user.signature}
          defaults={{ name: user.name, title: user.title ?? "", company: user.company.displayName || user.company.name, date: signDate(new Date()) }}
        />
      </section>
      <section className="card">
        <h2 className="border-b border-slate-200 px-5 py-3 font-semibold">Signed documents</h2>
        {docs.length === 0 ? (
          <EmptyState>Documents you sign are kept here.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <a href={`/signed-doc/${d.id}?view=1`} target="_blank" rel="noreferrer" className="link min-w-0 flex-1 truncate font-medium">{d.fileName}</a>
                <span className="text-xs text-slate-500">
                  {showSigner && `${d.signerName} · `}{when.format(d.signedAt)} · {kb(d.size)}
                </span>
                <a href={`/signed-doc/${d.id}`} className="link">Download</a>
                {(d.signedById === user.id || user.role === "ADMIN") && (
                  <ConfirmButton
                    action={deleteSignedDocument.bind(null, d.id)}
                    label="Remove"
                    confirmText={`Remove "${d.fileName}"? The signed copy can't be downloaded again.`}
                    className="text-slate-400 hover:text-red-600"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
