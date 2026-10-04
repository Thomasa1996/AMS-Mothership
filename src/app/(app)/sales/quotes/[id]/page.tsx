import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { quoteScope } from "@/lib/access";
import { formatDateTime } from "@/lib/format";
import { formatCents } from "@/lib/quote-math";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { deleteQuote, duplicateQuote, setQuoteStatus } from "../actions";
import { Proposal } from "../proposal";
import { QuoteStatusBadge } from "../status";
import { PrintButton } from "./print-button";
import { ReplacePdfForm, UploadedDetailsForm } from "../upload-forms";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const quote = await db.quote.findFirst({
    where: { id, ...quoteScope(user) },
    include: {
      lines: { orderBy: { position: "asc" } },
      file: { select: { fileName: true, size: true, uploadedAt: true } },
      company: true,
      createdBy: true,
      project: { include: { account: { select: { id: true, name: true } } } },
    },
  });
  if (!quote) notFound();

  const statusButton = (status: string, label: string, primary = false) =>
    quote.status !== status && (
      <form action={setQuoteStatus.bind(null, quote.id, status)}>
        <button className={`btn ${primary ? "btn-primary" : ""}`}>{label}</button>
      </form>
    );

  return (
    <div>
      <div className="mb-6 print:hidden">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Quote #{quote.number}: {quote.title}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <QuoteStatusBadge status={quote.status} />
              <Link href={`/crm/projects/${quote.project.id}`} className="link">{quote.project.name}</Link>
              <span>·</span>
              <Link href={`/crm/accounts/${quote.project.account.id}`} className="link">{quote.project.account.name}</Link>
              <span>· {formatCents(quote.totalCents)}</span>
              {quote.sentAt && <span>· sent {formatDateTime(quote.sentAt)}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {quote.uploaded ? (
              quote.file && <a href={`/quote-file/${quote.id}?download=1`} className="btn">Download PDF</a>
            ) : (
              <>
                <PrintButton />
                <Link href={`/sales/quotes/${quote.id}/edit`} className="btn">Edit</Link>
                <form action={duplicateQuote.bind(null, quote.id)}>
                  <button className="btn">Revise as new quote</button>
                </form>
              </>
            )}
            {statusButton("SENT", "Mark sent", quote.status === "DRAFT")}
            {statusButton("ACCEPTED", "Mark accepted", quote.status === "SENT")}
            {quote.status !== "DRAFT" && statusButton("DECLINED", "Mark declined")}
          </div>
        </div>
        {!quote.uploaded && <p className="text-sm text-slate-500">
          This is the proposal your client sees. Use Print / Save PDF and choose &ldquo;Save as PDF&rdquo; to send it.
          {quote.status === "SENT" && " Marking it accepted books the project and sets its value to this total."}
        </p>}
      </div>

      {quote.uploaded ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Uploaded PDF{quote.file ? `: ${quote.file.fileName}` : ""}, prepared by {quote.createdBy.name}.
            {quote.status === "SENT" && " Marking it accepted books the project and sets its value to this total."}
          </p>
          {quote.file ? (
            <iframe src={`/quote-file/${quote.id}`} title={quote.title} className="h-[80vh] w-full rounded-lg border border-slate-200 bg-white" />
          ) : (
            <div className="card p-6 text-sm text-slate-600">The PDF is missing. Upload it again below.</div>
          )}
          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">Quote details</h2>
            <UploadedDetailsForm
              id={quote.id}
              title={quote.title}
              quoteDate={quote.quoteDate.toISOString().slice(0, 10)}
              total={(quote.totalCents / 100).toFixed(2)}
            />
            <div className="border-t border-slate-100 pt-4">
              <ReplacePdfForm id={quote.id} />
            </div>
          </section>
        </div>
      ) : (
        <div className="-mx-4 bg-slate-200 px-4 py-6 print:m-0 print:bg-white print:p-0">
          <Proposal
            q={{
              ...quote,
              company: quote.company,
              preparedBy: { name: quote.createdBy.name, title: quote.createdBy.title, signature: quote.createdBy.signature },
            }}
          />
        </div>
      )}

      <div className="mt-6 print:hidden">
        <ConfirmButton action={deleteQuote.bind(null, quote.id)} label="Delete quote" confirmText={`Delete quote #${quote.number}?`} />
      </div>
    </div>
  );
}
