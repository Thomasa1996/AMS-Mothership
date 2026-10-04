import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { deleteTraining } from "./actions";
import { AddTrainingForm } from "./forms";

const sizeLabel = (bytes: number | null) => (bytes ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB` : "");
const hostLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
};

export default async function TrainingPage() {
  const user = await requireUser();
  const admin = user.role === "ADMIN";
  const items = await db.trainingItem.findMany({
    where: { companyId: user.companyId },
    select: { id: true, title: true, category: true, description: true, url: true, fileName: true, size: true },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  });
  const sections = [...new Set(items.map((i) => i.category))];

  return (
    <div className="space-y-6">
      <PageHeader title="Training" subtitle="Guides, checklists and videos for the team" />

      {items.length === 0 && (
        <div className="card">
          <EmptyState>{admin ? "No training yet. Add the first PDF or link below." : "No training has been posted yet."}</EmptyState>
        </div>
      )}

      {sections.map((section) => (
        <section key={section} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{section}</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {items
              .filter((i) => i.category === section)
              .map((i) => (
                <div key={i.id} className="card flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium">{i.title}</h3>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{i.fileName ? "PDF" : "Link"}</span>
                  </div>
                  {i.description && <p className="whitespace-pre-line text-sm text-slate-600">{i.description}</p>}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-sm">
                    {i.fileName ? (
                      <a href={`/training-file/${i.id}`} target="_blank" rel="noopener" className="link">Open PDF <span className="text-slate-400">{sizeLabel(i.size)}</span></a>
                    ) : (
                      <a href={i.url!} target="_blank" rel="noopener noreferrer" className="link">Open {hostLabel(i.url!)}</a>
                    )}
                    {admin && (
                      <ConfirmButton
                        action={deleteTraining.bind(null, i.id)}
                        label="Remove"
                        confirmText={`Remove "${i.title}" from Training?`}
                        className="text-slate-400 hover:text-red-600"
                      />
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}

      {admin && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Add training</h2>
          <p className="text-sm text-slate-500">Only admins see this. Everyone on the team can open what you add.</p>
          <AddTrainingForm categories={sections} />
        </section>
      )}
    </div>
  );
}
