import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { open } from "@/lib/secret-box";
import { defaultMailSince } from "@/lib/mail-proposals-run";
import { disconnectMail } from "./actions";
import { MailConnectForm, MailPeopleForm, MailSyncNowButton } from "./forms";

// Pull now runs a full pull in the request.
export const maxDuration = 60;

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

export default async function EmailProposalsSettingsPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/settings/profile");
  const [company, people] = await Promise.all([
    db.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: { mailTenantId: true, mailClientId: true, mailSecret: true, mailSince: true, mailSyncedAt: true, mailSyncResult: true, powerbiTenantId: true, powerbiClientId: true, powerbiSecret: true },
    }),
    db.user.findMany({ where: { companyId: user.companyId, active: true }, select: { id: true, name: true, email: true, mailProposals: true }, orderBy: { name: "asc" } }),
  ]);
  const secret = company.mailSecret ? open(company.mailSecret) : null;
  const connected = !!(company.mailTenantId && company.mailClientId && secret);
  const on = people.filter((p) => p.mailProposals);
  const failed = company.mailSyncResult?.startsWith("Failed: ");

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Email proposals"
        subtitle="Finds proposals in the Sent Items of the people you pick and files each one in Sales › Quotes under them, with its total, once a day and whenever you click Pull now. Reps don't upload anything, and nothing in anyone's mailbox is changed."
      />

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">1. Connection {connected ? <span className="badge ml-2 bg-emerald-100 text-emerald-800">Connected</span> : null}</h2>
          {connected && (
            <ConfirmButton
              action={disconnectMail}
              label="Disconnect"
              confirmText="Disconnect Microsoft 365? Proposals already pulled stay in Sales › Quotes."
              className="text-sm text-slate-500 hover:text-red-600"
            />
          )}
        </div>
        {company.mailSecret && !secret && <p className="text-sm text-red-600">The saved secret can no longer be read. Paste it again.</p>}
        <MailConnectForm
          tenantId={company.mailTenantId ?? company.powerbiTenantId ?? ""}
          clientId={company.mailClientId ?? company.powerbiClientId ?? ""}
          connected={connected}
          canReuse={!!(company.powerbiClientId && company.powerbiSecret)}
        />
        <details className="border-t border-slate-100 pt-4 text-sm text-slate-600" open={!connected}>
          <summary className="cursor-pointer font-medium text-slate-800">Setting up the app (send these steps to your Microsoft 365 admin)</summary>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>
              In the Azure portal (portal.azure.com), open <b>Microsoft Entra ID</b>, then <b>App registrations</b>. Use the Mothership app made for Power BI, or
              click <b>New registration</b> and name it Mothership. Copy the <b>Application (client) ID</b> and <b>Directory (tenant) ID</b> from its Overview page.
            </li>
            <li>
              In the app, open <b>API permissions</b>, then <b>Add a permission</b>, <b>Microsoft Graph</b>, <b>Application permissions</b>. Tick{" "}
              <b>Mail.Read</b>, click Add, then click <b>Grant admin consent</b>.
            </li>
            <li>
              For a new app, open <b>Certificates &amp; secrets</b>, then <b>New client secret</b>, and copy its <b>Value</b> right away. Paste it only here, never
              in a chat or email.
            </li>
            <li>
              Recommended: limit the app to the sales team&apos;s mailboxes. In Exchange Online PowerShell, put the reps in a mail-enabled security group and run{" "}
              <code className="rounded bg-slate-100 px-1">New-ApplicationAccessPolicy -AppId &lt;client ID&gt; -PolicyScopeGroupId &lt;group email&gt; -AccessRight RestrictAccess</code>.
              Without it, the app could read any mailbox, though Mothership only opens the ones ticked below.
            </li>
          </ol>
        </details>
      </section>

      {connected && (
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">2. Whose sent email to read</h2>
          <p className="text-sm text-slate-600">
            Mothership takes Word, PDF and Excel attachments whose file name or email subject says proposal, quote, estimate, bid or pricing. Each Mothership
            sign-in email must be the person&apos;s Microsoft 365 address. Try it on yourself first.
          </p>
          <MailPeopleForm
            people={people.map((p) => ({ id: p.id, name: p.name, email: p.email, on: p.mailProposals }))}
            since={(company.mailSince ?? defaultMailSince()).toISOString().slice(0, 10)}
          />
        </section>
      )}

      {connected && on.length > 0 && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">3. Last pull</h2>
          {company.mailSyncedAt ? (
            <p className={`text-sm ${failed ? "text-red-600" : "text-slate-600"}`}>
              {when.format(company.mailSyncedAt)}: {company.mailSyncResult}
            </p>
          ) : (
            <p className="text-sm text-slate-600">Not pulled yet.</p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <MailSyncNowButton />
            <Link href="/sales/quotes" className="link text-sm">Open Sales › Quotes</Link>
          </div>
        </section>
      )}
    </div>
  );
}
