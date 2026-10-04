import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isPublicLink } from "@/lib/powerbi";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { removeReport } from "./actions";
import { AddReportForm } from "./forms";

// Tables Power BI may read. User is limited to non-sensitive columns; Company (which holds the
// encrypted HubSpot and Smartsheet keys) is left out.
const READ_TABLES = ["Account", "Contact", "Project", "Activity", "Quote", "QuoteLine", "RateItem", "Branch", "BranchRate", "Vendor"];

const READER_SQL = [
  `CREATE ROLE powerbi_reader WITH LOGIN PASSWORD 'pick-a-long-password';`,
  `GRANT USAGE ON SCHEMA public TO powerbi_reader;`,
  `GRANT SELECT ON ${READ_TABLES.map((t) => `"${t}"`).join(", ")} TO powerbi_reader;`,
  `GRANT SELECT ("id", "name", "email", "role", "title") ON "User" TO powerbi_reader;`,
].join("\n");

// Reports are admins only for now.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/crm/accounts");
  const { r } = await searchParams;
  const reports = await db.powerBiReport.findMany({ where: { companyId: user.companyId }, orderBy: { position: "asc" } });
  const current = reports.find((x) => x.id === r) ?? reports[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Power BI reports. Only admins can see this tab." />

      {current ? (
        <section className="space-y-3">
          {reports.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {reports.map((x) => (
                <Link key={x.id} href={`/reports?r=${x.id}`} className={`btn ${x.id === current.id ? "border-brand-500 text-brand-700" : ""}`}>
                  {x.name}
                </Link>
              ))}
            </div>
          )}
          {/* Power BI pages are 16:9 with a page tab bar under them. The frame takes that shape, as wide as
              the page allows while still fitting on screen, so the report fills it with no blank bands. */}
          <div
            className="card mx-auto overflow-hidden"
            style={{ ["--w" as string]: "min(min(100vw, 80rem) - 2rem, (100vh - 12rem) * 16 / 9)", width: "var(--w)" }}
          >
            <iframe
              key={current.id}
              title={current.name}
              src={current.embedUrl}
              className="block w-full border-0 bg-white"
              style={{ height: "calc(var(--w) * 0.5625 + 2.5rem)" }}
              allowFullScreen
            />
          </div>
          <p className="text-xs text-slate-500">
            If the report asks you to sign in, use your work Microsoft account. You need access to the report in Power BI.
            <a href={current.embedUrl} target="_blank" rel="noreferrer" className="link ml-2">Open in a new tab ↗</a>
          </p>
        </section>
      ) : (
        <div className="card p-6 text-sm text-slate-600">No reports yet. Add your first Power BI report below.</div>
      )}

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Manage reports</h2>
        {reports.length > 0 && (
          <ul className="divide-y divide-slate-100 text-sm">
            {reports.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {x.name}
                  {isPublicLink(x.embedUrl) && (
                    <span className="badge ml-2 bg-amber-100 text-amber-800" title="Publish to web links can be opened by anyone who has the link">Public link</span>
                  )}
                </span>
                <ConfirmButton
                  action={removeReport.bind(null, x.id)}
                  label="Remove"
                  confirmText={`Remove ${x.name} from Mothership? The report stays in Power BI.`}
                  className="text-sm text-slate-500 hover:text-red-600"
                />
              </li>
            ))}
          </ul>
        )}
        <AddReportForm />
        <div className="text-sm text-slate-600">
          <p className="mb-1 font-medium text-slate-800">Getting the embed link</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open the report in Power BI (app.powerbi.com).</li>
            <li>Click File, then Embed report, then Website or portal.</li>
            <li>Copy the first link and paste it above. The link from your browserCopy the first link and paste it above. Viewers sign in with Microsoft, so the report stays private.apos;s address bar while viewing the report works too. Viewers sign in with Microsoft, so the report stays private.</li>
          </ol>
        </div>
      </section>

      <details className="card p-5 text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-800">Connecting Power BI to Mothership&apos;s data</summary>
        <div className="mt-3 space-y-3">
          <p>Power BI can read Mothership&apos;s database directly, so reports always use live numbers. Set up a read-only login first so a report can never change anything:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              In Neon (console.neon.tech), open your project, then SQL Editor, and run this with your own password:
              <pre className="mt-2 overflow-x-auto rounded-md bg-slate-100 p-3 font-mono text-xs text-slate-800">{READER_SQL}</pre>
            </li>
            <li>In Neon, click Connect and note the host (it ends in neon.tech) and the database name (usually neondb).</li>
            <li>
              In Power BI Desktop, click Get data, then PostgreSQL database. Enter that host and database, choose Import, then sign in with
              the Database option as powerbi_reader and your password.
            </li>
            <li>Pick the tables you need. Money columns ending in Cents are in cents, so divide by 100.</li>
          </ol>
          <p>Logins, passwords and the HubSpot and Smartsheet keys aren&apos;t included in what powerbi_reader can see.</p>
        </div>
      </details>
    </div>
  );
}
