import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fileKind } from "@/lib/file-upload";
import { EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { deleteQuoteTemplate } from "./actions";
import { AddTemplateForm } from "./forms";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" });

// Starting files for quotes (usually Word). Admins add them; everyone downloads a copy to fill in.
export default async function QuoteTemplatesPage() {
  const user = await requireUser();
  const admin = user.role === "ADMIN";
  const templates = await db.quoteTemplate.findMany({
    where: { companyId: user.companyId },
    select: { id: true, name: true, description: true, fileName: true, uploadedAt: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Quote templates" subtitle="Download a template, fill it in with Word, then add the finished quote under Quotes" />
      {templates.length === 0 ? (
        <div className="card">
          <EmptyState>{admin ? "No templates yet. Add the first one below." : "No templates have been added yet."}</EmptyState>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">{t.name}</h3>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{fileKind(t.fileName)}</span>
              </div>
              {t.description && <p className="text-sm text-slate-600">{t.description}</p>}
              <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-sm">
                <a href={`/quote-template/${t.id}`} className="link">Download</a>
                <span className="text-xs text-slate-400">Added {day.format(t.uploadedAt)}</span>
                {admin && (
                  <ConfirmButton
                    action={deleteQuoteTemplate.bind(null, t.id)}
                    label="Remove"
                    confirmText={`Remove the "${t.name}" template?`}
                    className="text-slate-400 hover:text-red-600"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {admin && (
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Add a template</h2>
          <AddTemplateForm />
        </section>
      )}
    </div>
  );
}
