import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { getColumns, listSheets, SmartsheetError } from "@/lib/smartsheet";
import { guessColumns, parseImportConfig } from "@/lib/smartsheet-import";
import { smartsheetFor } from "@/lib/smartsheet-company";
import { disconnectSmartsheet, stopImport } from "./actions";
import { ConnectForm, ImportForm, ImportNowButton, SheetChoiceForm } from "./forms";

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

export default async function SmartsheetSettingsPage({ searchParams }: { searchParams: Promise<{ importSheet?: string }> }) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/settings/profile");
  const { importSheet } = await searchParams;
  const company = await db.company.findUniqueOrThrow({
    where: { id: user.companyId },
    select: { smartsheetToken: true, smartsheetRegion: true, smartsheetImport: true, smartsheetImportedAt: true, smartsheetImportResult: true },
  });
  const conn = await smartsheetFor(user.companyId);
  let sheets: { id: string; name: string }[] = [];
  let error: string | null = null;
  if (conn) {
    try {
      sheets = (await listSheets(conn.token, conn.region)).map((s) => ({ id: String(s.id), name: s.name }));
    } catch (e) {
      error = e instanceof SmartsheetError ? e.message : "Couldn't load your sheets from Smartsheet.";
    }
  }
  const connected = !!company.smartsheetToken;

  // Projects import: the saved sheet, or the one just picked in the form, and its columns.
  const config = parseImportConfig(company.smartsheetImport);
  const importSheetId = importSheet && /^\d+$/.test(importSheet) ? importSheet : config?.sheetId ?? "";
  let columns: { id: string; title: string }[] = [];
  let columnsError: string | null = null;
  if (conn && importSheetId) {
    try {
      columns = (await getColumns(conn.token, conn.region, importSheetId)).map((c) => ({ id: String(c.id), title: c.title }));
    } catch (e) {
      columnsError = e instanceof SmartsheetError ? e.message : "Couldn't load that sheet's columns.";
    }
  }
  const mapping = config && config.sheetId === importSheetId ? config.columns : guessColumns(columns);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Smartsheet"
        subtitle="Shows your Smartsheet sheets under Sales, Project management, and can copy your project sheet into the CRM. Nothing in Smartsheet is changed."
      />
      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{connected ? "Connected" : "Not connected"}</h2>
          {connected && (
            <ConfirmButton
              action={disconnectSmartsheet}
              label="Disconnect"
              confirmText="Disconnect Smartsheet? Project management will be empty until it's connected again."
              className="text-sm text-slate-500 hover:text-red-600"
            />
          )}
        </div>
        {connected && !conn && <p className="text-sm text-red-600">The saved token can no longer be read. Paste it again below.</p>}
        <ConnectForm connected={connected} region={company.smartsheetRegion} />
        {!connected && (
          <div className="border-t border-slate-100 pt-4 text-sm text-slate-600">
            <p className="mb-1 font-medium text-slate-800">Getting the token from Smartsheet</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>In Smartsheet, click your account picture (bottom left), then Apps &amp; Integrations.</li>
              <li>Open API Access, click Generate new access token, and name it Mothership.</li>
              <li>Copy the token and paste it above. Mothership sees the sheets that Smartsheet account can see.</li>
            </ol>
          </div>
        )}
      </section>
      {conn && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Sheets to show</h2>
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <SheetChoiceForm sheets={sheets} chosen={conn.sheetIds} />
          )}
        </section>
      )}
      {conn && !error && (
        <section className="card space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Send projects to the CRM</h2>
              <p className="text-sm text-slate-500">
                Each row of your project sheet becomes a project in CRM, under the account for its client (created if needed). It runs every morning and whenever you click Import now. Changes in Smartsheet carry over; nothing is written back to Smartsheet.
              </p>
            </div>
            {config && (
              <ConfirmButton
                action={stopImport}
                label="Stop importing"
                confirmText="Stop importing projects from Smartsheet? Projects already imported stay in the CRM."
                className="text-sm text-slate-500 hover:text-red-600"
              />
            )}
          </div>
          {config && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 p-3 text-sm">
              <span>
                {company.smartsheetImportedAt ? `Last import ${when.format(company.smartsheetImportedAt)}: ${company.smartsheetImportResult ?? ""}` : "Not imported yet."}
              </span>
              <ImportNowButton />
            </div>
          )}
          {columnsError && <p className="text-sm text-red-600">{columnsError}</p>}
          <ImportForm key={importSheetId} sheets={sheets} sheetId={importSheetId} columns={columns} mapping={mapping} saved={!!config} />
        </section>
      )}
    </div>
  );
}
