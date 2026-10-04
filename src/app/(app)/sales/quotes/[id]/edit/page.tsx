import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { quoteScope } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { updateQuote } from "../../actions";
import { QuoteBuilder } from "../../builder";
import { builderOptions, draftFromQuote } from "../../load";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const quote = await db.quote.findFirst({
    where: { id, ...quoteScope(user) },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!quote) notFound();
  // Uploaded PDF quotes are edited on their own page (details and Replace PDF).
  if (quote.uploaded) redirect(`/sales/quotes/${quote.id}`);
  const options = await builderOptions(user);
  return (
    <div>
      <PageHeader title={`Edit quote #${quote.number}`} subtitle={quote.title} />
      <QuoteBuilder initial={draftFromQuote(quote)} {...options} save={updateQuote.bind(null, quote.id)} submitLabel="Save changes" />
    </div>
  );
}
