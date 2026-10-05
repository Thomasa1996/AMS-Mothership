import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { getSheet, sheetTable, SmartsheetError } from "@/lib/smartsheet";
import { sheetVisible, smartsheetFor } from "@/lib/smartsheet-company";
import { SheetGrid } from "./sheet-grid";

export default async function SheetPage({ params }: { params: Promise<{ sheetId: string }> }) {
  const user = await requireUser();
  const { sheetId } = await params;
  if (!/^\d+$/.test(sheetId)) notFound();
  const conn = await smartsheetFor(user.companyId);
  if (!conn) redirect("/operations/remote-control");
  if (!sheetVisible(conn.sheetIds, sheetId)) notFound();

  const back = <Link href="/operations/remote-control" className="text-sm text-slate-500 hover:text-slate-700">&larr; Remote control</Link>;
  try {
    const sheet = await getSheet(conn.token, conn.region, sheetId);
    const table = sheetTable(sheet);
    return (
      <div className="space-y-3">
        {back}
        <PageHeader
          title={sheet.name}
          subtitle={`${table.rows.length} rows · read live from Smartsheet`}
          actions={sheet.permalink ? <a href={sheet.permalink} target="_blank" rel="noreferrer" className="btn">Open in Smartsheet ↗</a> : undefined}
        />
        <SheetGrid columns={table.columns} rows={table.rows} />
      </div>
    );
  } catch (e) {
    if (e instanceof SmartsheetError && e.status === 404) notFound();
    return (
      <div className="space-y-3">
        {back}
        <div className="card p-6 text-sm text-red-600">{e instanceof SmartsheetError ? e.message : "Couldn't load this sheet from Smartsheet."}</div>
      </div>
    );
  }
}
