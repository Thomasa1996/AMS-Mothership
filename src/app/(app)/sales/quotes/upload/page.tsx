import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { builderOptions } from "../load";
import { UploadQuoteForm } from "../upload-forms";

export default async function UploadQuotePage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const user = await requireUser();
  const { projectId = "" } = await searchParams;
  const { projects, markets } = await builderOptions(user);
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Upload a PDF quote"
        subtitle="For quotes written in Word. It's listed with your other quotes and tracked the same way: sent, accepted or declined."
      />
      <UploadQuoteForm
        projects={projects.map((p) => ({ id: p.id, name: p.name, accountName: p.accountName }))}
        markets={markets.map((m) => ({ id: m.id, name: m.name }))}
        projectId={projects.some((p) => p.id === projectId) ? projectId : ""}
      />
    </div>
  );
}
