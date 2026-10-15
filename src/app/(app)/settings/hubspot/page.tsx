import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { disconnectHubSpot } from "./actions";
import { ConnectForm, QuotesSwitch, SendQuotesForm, SyncForm } from "./forms";
import { waitingForHubSpot } from "@/lib/hubspot-quotes";

// A first sync of a few thousand records can take a while.
export const maxDuration = 60;

const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

export default async function HubSpotSettingsPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/settings/profile");
  const company = await db.company.findUniqueOrThrow({ where: { id: user.companyId } });
  const connected = !!company.hubspotToken;
  const synced = await db.account.count({ where: { companyId: user.companyId, hubspotId: { not: null } } });
  const quoteCount = (where: Prisma.QuoteDocWhereInput) => db.quoteDoc.count({ where: { companyId: user.companyId, ...where } });
  const [sent, waiting, failed, noAccount, notHubSpot] = await Promise.all([
    quoteCount({ hubspotSentAt: { not: null } }),
    db.quoteDoc.count({ where: waitingForHubSpot(user.companyId) }),
    quoteCount({ hubspotSentAt: null, hubspotError: { not: null } }),
    quoteCount({ accountId: null }),
    quoteCount({ account: { hubspotId: null } }),
  ]);
  const lastError = failed ? await db.quoteDoc.findFirst({ where: { companyId: user.companyId, hubspotSentAt: null, hubspotError: { not: null } }, select: { hubspotError: true } }) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="HubSpot"
        subtitle="Copies companies, contacts and deals from HubSpot into Mothership while your team switches over. Nothing in HubSpot is changed, except quote files if you turn that on below."
      />
      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{connected ? "Connected" : "Not connected"}</h2>
          {connected && (
            <ConfirmButton
              action={disconnectHubSpot}
              label="Disconnect"
              confirmText="Disconnect HubSpot? Records already copied stay in Mothership."
              className="text-sm text-slate-500 hover:text-red-600"
            />
          )}
        </div>
        <ConnectForm connected={connected} />
        {!connected && (
          <div className="border-t border-slate-100 pt-4 text-sm text-slate-600">
            <p className="mb-1 font-medium text-slate-800">Getting the key from HubSpot</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>In HubSpot, open Settings (the gear), then Integrations, then Private Apps, and click Create a private app.</li>
              <li>Name it Mothership. On the Scopes tab, tick read for crm.objects.companies, crm.objects.contacts, crm.objects.deals and crm.objects.owners.</li>
              <li>Click Create app, then copy the access token and paste it above.</li>
            </ol>
          </div>
        )}
      </section>
      {connected && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Sync</h2>
          <p className="text-sm text-slate-600">
            Runs automatically once a day. A record is only updated when it changed in HubSpot, so edits made here stick.
            HubSpot owners are matched to your team by email; add teammates with the same email they use in HubSpot.
          </p>
          <SyncForm />
          <div className="text-sm text-slate-600">
            <p>{synced} accounts have come from HubSpot so far.</p>
            {company.hubspotSyncedAt && (
              <p className="mt-1">
                Last sync {dateTime.format(company.hubspotSyncedAt)} (Eastern): {company.hubspotSyncResult}
              </p>
            )}
          </div>
        </section>
      )}
      {connected && (
        <section className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Quotes to HubSpot {company.hubspotQuotes ? <span className="ml-1 text-sm font-normal text-emerald-600">On</span> : <span className="ml-1 text-sm font-normal text-slate-500">Off</span>}</h2>
            <QuotesSwitch on={company.hubspotQuotes} />
          </div>
          <p className="text-sm text-slate-600">
            Each quote file in Sales › Quotes is matched to its client account, from the email it was sent to or the company named in it (reps can change it).
            When that account came from HubSpot, the file is attached to the company there as a note with its total, market and rep. Each file is sent once.
          </p>
          <div className="border-t border-slate-100 pt-3 text-sm text-slate-600">
            <p className="mb-1 font-medium text-slate-800">First, let the key write to HubSpot</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>In HubSpot, open Settings (the gear), then Integrations, then Private Apps, and open the Mothership app.</li>
              <li>On its Scopes tab, also tick files, crm.objects.contacts write and crm.objects.companies write, then Commit changes.</li>
              <li>The key stays the same, so nothing needs pasting again.</li>
            </ol>
          </div>
          {company.hubspotQuotes && (
            <div className="space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
              <p>
                {sent} sent · {waiting} waiting · {noAccount} with no account picked · {notHubSpot} on accounts that aren&apos;t in HubSpot
                {failed > 0 && <span className="text-red-600"> · {failed} couldn&apos;t be sent</span>}
              </p>
              {lastError?.hubspotError && <p className="text-red-600">Last problem: {lastError.hubspotError}</p>}
              <p>New files go as they&apos;re added; anything left waiting goes with the daily sync.</p>
              <SendQuotesForm />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
