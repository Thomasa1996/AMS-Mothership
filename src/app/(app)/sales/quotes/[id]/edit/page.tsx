import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { updateQuote } from "../../actions";
import { QuoteBuilder } from "../../builder";
import { builderOptions, draftFromQuote } from "../../load";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const quote = await db.quote.findFirst({
    where: { id, companyId: user.companyId },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!quote) notFound();
  const options = await builderOptions(user.companyId);
  return (
    <div>
      <PageHeader title={`Edit quote #${quote.number}`} subtitle={quote.title} />
      <QuoteBuilder initial={draftFromQuote(quote)} {...options} save={updateQuote.bind(null, quote.id)} submitLabel="Save changes" />
    </div>
  );
}
