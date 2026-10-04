import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { listSheets, SmartsheetError } from "@/lib/smartsheet";
import { sheetVisible, smartsheetFor } from "@/lib/smartsheet-company";

const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

export default async function ProjectManagementPage() {
  const user = await requireUser();
  const conn = await smartsheetFor(user.companyId);
  const admin = user.role === "ADMIN";

  if (!conn) {
    return (
      <div>
        <PageHeader title="Project management" subtitle="Your project sheets from Smartsheet" />
        <div className="card p-6 text-sm text-slate-600">
          Smartsheet isn&apos;t connected yet.{" "}
          {admin ? (
            <Link href="/settings/smartsheet" className="link">Connect Smartsheet</Link>
          ) : (
            "Ask an admin to connect it in Settings."
          )}
        </div>
      </div>
    );
  }

  let sheets: Awaited<ReturnType<typeof listSheets>> = [];
  let error: string | null = null;
  try {
    sheets = (await listSheets(conn.token, conn.region)).filter((s) => sheetVisible(conn.sheetIds, s.id));
  } catch (e) {
    error = e instanceof SmartsheetError ? e.message : "Couldn't load your sheets from Smartsheet.";
  }

  return (
    <div>
      <PageHeader
        title="Project management"
        subtitle={error ? "Your project sheets from Smartsheet" : `${sheets.length} sheets from Smartsheet, read live`}
        actions={admin ? <Link href="/settings/smartsheet" className="btn">Choose sheets</Link> : undefined}
      />
      {error ? (
        <div className="card p-6 text-sm text-red-600">{error}</div>
      ) : sheets.length === 0 ? (
        <div className="card p-6 text-sm text-slate-600">No sheets to show. The Smartsheet account behind the token may not have any sheets shared with it.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Sheet</th><th>Last changed (Eastern)</th><th /></tr>
            </thead>
            <tbody>
              {sheets.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/sales/project-management/${s.id}`} className="link">{s.name}</Link></td>
                  <td className="text-slate-600">{s.modifiedAt ? dateTime.format(new Date(s.modifiedAt)) : ""}</td>
                  <td className="text-right">
                    {s.permalink && <a href={s.permalink} target="_blank" rel="noreferrer" className="text-sm text-slate-500 hover:text-slate-700">Open in Smartsheet ↗</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
