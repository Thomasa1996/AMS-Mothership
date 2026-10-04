import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { listSheets, SmartsheetError } from "@/lib/smartsheet";
import { smartsheetFor } from "@/lib/smartsheet-company";
import { disconnectSmartsheet } from "./actions";
import { ConnectForm, SheetChoiceForm } from "./forms";

export default async function SmartsheetSettingsPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/settings/profile");
  const company = await db.company.findUniqueOrThrow({ where: { id: user.companyId }, select: { smartsheetToken: true, smartsheetRegion: true } });
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

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Smartsheet"
        subtitle="Shows your Smartsheet sheets under Sales, Project management. Sheets are read live and nothing in Smartsheet is changed."
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
    </div>
  );
}
