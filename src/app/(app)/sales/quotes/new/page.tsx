import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { createQuote } from "../actions";
import { QuoteBuilder } from "../builder";
import { builderOptions, newQuoteDraft } from "../load";

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const user = await requireUser();
  const { projectId } = await searchParams;
  const [options, initial] = await Promise.all([builderOptions(user.companyId), newQuoteDraft(user.companyId, projectId)]);
  return (
    <div>
      <PageHeader title="New quote" subtitle="Builds a Project Recommendation Plan from your quote template and rate card" />
      <QuoteBuilder initial={initial} {...options} save={createQuote} submitLabel="Save quote" />
    </div>
  );
}
