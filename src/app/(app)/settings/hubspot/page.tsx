import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { disconnectHubSpot } from "./actions";
import { ConnectForm, SyncForm } from "./forms";

// A first sync of a few thousand records can take a while.
export const maxDuration = 60;

const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

export default async function HubSpotSettingsPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/settings/profile");
  const company = await db.company.findUniqueOrThrow({ where: { id: user.companyId } });
  const connected = !!company.hubspotToken;
  const synced = await db.account.count({ where: { companyId: user.companyId, hubspotId: { not: null } } });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="HubSpot"
        subtitle="Copies companies, contacts and deals from HubSpot into Mothership while your team switches over. Nothing in HubSpot is changed."
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
    </div>
  );
}
