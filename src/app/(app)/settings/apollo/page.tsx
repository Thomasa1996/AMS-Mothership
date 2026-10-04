import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { open } from "@/lib/secret-box";
import { disconnectApollo } from "./actions";
import { ApolloKeyForm } from "./forms";

export default async function ApolloSettingsPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/settings/profile");
  const company = await db.company.findUniqueOrThrow({ where: { id: user.companyId }, select: { apolloKey: true } });
  const connected = !!company.apolloKey;
  const readable = connected && !!open(company.apolloKey!);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Apollo"
        subtitle="Lets the team search Apollo for new prospects under Sales, New Business Development, and add them to the CRM."
      />
      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{connected ? "Connected" : "Not connected"}</h2>
          {connected && (
            <ConfirmButton
              action={disconnectApollo}
              label="Disconnect"
              confirmText="Disconnect Apollo? New Business Development won't search until it's connected again."
              className="text-sm text-slate-500 hover:text-red-600"
            />
          )}
        </div>
        {connected && !readable && <p className="text-sm text-red-600">The saved key can no longer be read. Paste it again below.</p>}
        <ApolloKeyForm connected={connected} />
        <div className="border-t border-slate-100 pt-4 text-sm text-slate-600">
          <p className="mb-1 font-medium text-slate-800">Getting the key from Apollo</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>In Apollo, open Settings, then Integrations, then API, and click Create new key.</li>
            <li>Name it Mothership and turn on <b>Set as master key</b>. Apollo only lets master keys search people.</li>
            <li>Copy the key and paste it above. Paste it only here, never in a chat or email.</li>
          </ol>
          <p className="mt-3">Searching is free. Adding a person to the CRM looks up their full name and work email, which uses 1 Apollo credit.</p>
        </div>
      </section>
    </div>
  );
}
