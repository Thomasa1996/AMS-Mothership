import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { open } from "@/lib/secret-box";
import { DEFAULT_SERIES, PowerBiError, getToken, listDatasets, listFields, listWorkspaces, parseRevenueSource, tenantFromLink, type Dataset, type Field, type Workspace } from "@/lib/powerbi-api";
import { disconnectPowerBi } from "./actions";
import { ConnectForm, RevenueForm, SyncNowButton } from "./forms";

const simple = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// First guesses for a new setup: a measure named like the line, and a date table's Date column.
function guessMeasure(amounts: Field[], name: string) {
  return amounts.find((f) => !f.ref.startsWith("SUM(") && simple(f.ref) === simple(name))?.ref ?? "";
}
function guessDate(dates: Field[]) {
  return (dates.find((f) => /^'(date|calendar|dates)'\[date\]$/i.test(f.ref)) ?? dates.find((f) => /\[date\]$/i.test(f.ref)))?.ref ?? "";
}

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

export default async function PowerBiSettingsPage({ searchParams }: { searchParams: Promise<{ ws?: string; ds?: string }> }) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/settings/profile");
  const params = await searchParams;
  const [company, firstReport] = await Promise.all([
    db.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: { powerbiTenantId: true, powerbiClientId: true, powerbiSecret: true, powerbiRevenue: true, powerbiSyncedAt: true, powerbiSyncResult: true },
    }),
    db.powerBiReport.findFirst({ where: { companyId: user.companyId }, orderBy: { position: "asc" }, select: { embedUrl: true } }),
  ]);
  const secret = company.powerbiSecret ? open(company.powerbiSecret) : null;
  const connected = !!(company.powerbiTenantId && company.powerbiClientId && secret);
  const source = parseRevenueSource(company.powerbiRevenue);
  const ws = params.ws ?? source?.groupId ?? "";
  const ds = params.ds ?? (ws === source?.groupId ? source?.datasetId : "") ?? "";

  // Look up workspaces, datasets and fields live, so the picks match what's in Power BI now.
  let error: string | null = null;
  let workspaces: Workspace[] = [];
  let datasets: Dataset[] = [];
  let fields: { dates: Field[]; amounts: Field[] } | null = null;
  let fieldsError: string | null = null;
  if (connected) {
    try {
      const token = await getToken({ tenantId: company.powerbiTenantId!, clientId: company.powerbiClientId!, secret: secret! });
      workspaces = await listWorkspaces(token);
      if (ws) datasets = await listDatasets(token, ws);
      if (ws && ds) {
        try {
          fields = await listFields(token, ws, ds);
        } catch (e) {
          fieldsError = e instanceof PowerBiError ? e.message : "Couldn't list the dataset's columns.";
          fields = { dates: [], amounts: [] };
        }
      }
    } catch (e) {
      error = e instanceof PowerBiError ? e.message : "Couldn't reach Power BI. Try again.";
    }
  }
  const failed = company.powerbiSyncResult?.startsWith("Failed: ");

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Power BI"
        subtitle="Reads Commercial Revenue (Actual Rev and Corporate Account) by month from your Power BI dataset for Revenue › Year over year, once a day and whenever you click Read now. Nothing in Power BI is changed."
      />

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">1. Connection {connected ? <span className="badge ml-2 bg-emerald-100 text-emerald-800">Connected</span> : null}</h2>
          {connected && (
            <ConfirmButton
              action={disconnectPowerBi}
              label="Disconnect"
              confirmText="Disconnect Power BI? Months already read stay on Year over year."
              className="text-sm text-slate-500 hover:text-red-600"
            />
          )}
        </div>
        {company.powerbiSecret && !secret && <p className="text-sm text-red-600">The saved secret can no longer be read. Paste it again.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ConnectForm
          tenantId={company.powerbiTenantId ?? (firstReport ? tenantFromLink(firstReport.embedUrl) ?? "" : "")}
          clientId={company.powerbiClientId ?? ""}
          connected={connected}
        />
        <details className="border-t border-slate-100 pt-4 text-sm text-slate-600" open={!connected}>
          <summary className="cursor-pointer font-medium text-slate-800">Setting up the app (send these steps to your Microsoft 365 or Power BI admin)</summary>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>
              In the Azure portal (portal.azure.com), open <b>Microsoft Entra ID</b>, then <b>App registrations</b>, then <b>New registration</b>. Name it
              Mothership and click Register. Copy the <b>Application (client) ID</b> and <b>Directory (tenant) ID</b> from its Overview page.
            </li>
            <li>
              In the app, open <b>Certificates &amp; secrets</b>, then <b>New client secret</b>. Copy the secret&apos;s <b>Value</b> right away (it is only shown
              once). Paste it only here, never in a chat or email. Note when it expires; it needs renewing then.
            </li>
            <li>In Entra ID, open <b>Groups</b>, create a security group such as &quot;Power BI apps&quot;, and add the Mothership app to it.</li>
            <li>
              In Power BI (app.powerbi.com), open Settings, then <b>Admin portal</b>, then <b>Tenant settings</b>. Under Developer settings, turn on{" "}
              <b>Service principals can call Fabric public APIs</b> for that group. Check that <b>Semantic Model Execute Queries REST API</b> (under Integration settings) is on.
              These changes can take 15 minutes to apply.
            </li>
            <li>
              Open the workspace that holds your revenue report, click <b>Manage access</b>, and add Mothership as a <b>Member</b>. A report in My workspace
              must be moved to a shared workspace first, since apps can&apos;t see anyone&apos;s My workspace.
            </li>
          </ol>
          <p className="mt-2">Datasets that use row-level security can&apos;t be read by an app. If yours does, upload a Power BI export on Revenue › Year over year instead.</p>
        </details>
      </section>

      {connected && !error && (
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">2. Revenue dataset</h2>
          {workspaces.length === 0 ? (
            <p className="text-sm text-slate-600">The app can&apos;t see any workspaces yet. Add it to your report&apos;s workspace as a Member (step 5), then reload this page.</p>
          ) : (
            <form method="get" className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="ws">Workspace</label>
                <select className="input w-auto" id="ws" name="ws" defaultValue={ws}>
                  <option value="">Pick a workspace</option>
                  {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              {ws && datasets.length > 0 && (
                <div>
                  <label className="label" htmlFor="ds">Dataset (semantic model)</label>
                  <select className="input w-auto" id="ds" name="ds" defaultValue={ds}>
                    <option value="">Pick a dataset</option>
                    {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              <button className="btn">Next</button>
              {ws && datasets.length === 0 && <p className="w-full text-sm text-slate-600">That workspace has no datasets the app can open.</p>}
            </form>
          )}
          {fields && (
            <>
              {fieldsError && (
                <p className="text-sm text-amber-700">
                  {fieldsError} You can still type the date column and measure names, like &apos;Date&apos;[Date] and [Commercial Revenue].
                </p>
              )}
              <RevenueForm
                groupId={ws}
                datasetId={ds}
                dates={fields.dates}
                amounts={fields.amounts}
                current={
                  source?.datasetId === ds
                    ? { dateColumn: source.dateColumn, series: source.series }
                    : { dateColumn: guessDate(fields.dates), series: DEFAULT_SERIES.map((name) => ({ name, amount: guessMeasure(fields!.amounts, name) })) }
                }
              />
            </>
          )}
        </section>
      )}

      {connected && source && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">3. Last read</h2>
          {company.powerbiSyncedAt ? (
            <p className={`text-sm ${failed ? "text-red-600" : "text-slate-600"}`}>
              {when.format(company.powerbiSyncedAt)}: {company.powerbiSyncResult}
            </p>
          ) : (
            <p className="text-sm text-slate-600">Not read yet.</p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <SyncNowButton />
            <Link href="/reports/yoy" className="link text-sm">Open Year over year</Link>
          </div>
        </section>
      )}
    </div>
  );
}
