import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fileKind } from "@/lib/file-upload";
import { EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { deleteMarketingFile } from "./actions";
import { MarketingUpload } from "./upload";
import { MarketingPreview } from "./preview";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" });
const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Shared marketing files. Admins add and remove them; everyone can view and download.
export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  const user = await requireUser();
  const admin = user.role === "ADMIN";
  const { q = "", kind = "" } = await searchParams;
  const all = await db.marketingFile.findMany({
    where: { companyId: user.companyId, ...(q ? { fileName: { contains: q, mode: "insensitive" as const } } : {}) },
    select: { id: true, fileName: true, contentType: true, size: true, uploadedAt: true, uploadedById: true },
    orderBy: { uploadedAt: "desc" },
  });
  const previewed = new Set(
    (await db.marketingFile.findMany({ where: { companyId: user.companyId, thumbnail: { not: null } }, select: { id: true } })).map((f) => f.id),
  );
  const kinds = [...new Set(all.map((f) => fileKind(f.fileName)))].sort();
  const files = kind ? all.filter((f) => fileKind(f.fileName) === kind) : all;
  const people = new Map(
    (await db.user.findMany({ where: { id: { in: [...new Set(all.map((f) => f.uploadedById).filter((x): x is string => !!x))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Marketing" subtitle={admin ? "Files for the whole team. You can add and remove them." : "Brochures, logos, decks and photos for the team to use."} />
      {admin && <MarketingUpload />}
      {(all.length > 0 || q) && (
        <form className="flex flex-wrap gap-2">
          <input className="input max-w-xs" name="q" defaultValue={q} placeholder="Search file names" />
          <select className="input w-auto" name="kind" defaultValue={kind}>
            <option value="">All kinds</option>
            {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <button className="btn">Filter</button>
          {(q || kind) && <Link href="/marketing" className="btn">Clear</Link>}
        </form>
      )}
      {files.length === 0 ? (
        <div className="card">
          <EmptyState>{q || kind ? "No files match." : admin ? "No marketing files yet. Drop the first ones above." : "No marketing files have been added yet."}</EmptyState>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {files.map((f) => (
            <div key={f.id} className="card flex min-w-0 flex-col overflow-hidden">
              <a href={`/marketing-file/${f.id}?view`} target="_blank" rel="noreferrer" className="block">
                <MarketingPreview id={f.id} fileName={f.fileName} kind={fileKind(f.fileName)} saved={previewed.has(f.id)} admin={admin} />
              </a>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <a href={`/marketing-file/${f.id}?view`} target="_blank" rel="noreferrer" className="link break-words text-sm font-medium">{f.fileName}</a>
                <p className="text-xs text-slate-500">
                  {fileKind(f.fileName)} · {size(f.size)} · {day.format(f.uploadedAt)}
                  {f.uploadedById && people.get(f.uploadedById) ? ` · ${people.get(f.uploadedById)}` : ""}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-sm">
                  <a href={`/marketing-file/${f.id}`} className="link">Download</a>
                  {admin && (
                    <ConfirmButton
                      action={deleteMarketingFile.bind(null, f.id)}
                      label="Remove"
                      confirmText={`Remove ${f.fileName}?`}
                      className="text-slate-400 hover:text-red-600"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
