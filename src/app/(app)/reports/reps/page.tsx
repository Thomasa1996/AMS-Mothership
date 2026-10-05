import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/ui";
import { photoUrl } from "@/lib/photos";
import { formatCents } from "@/lib/quote-math";
import { repStats, winRate } from "@/lib/rep-stats";
import { setOnRepBoard } from "../actions";

const dollars = (n: number) => `$${Math.round(n).toLocaleString()}`;
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export default async function SalesRepsPage() {
  const user = await requireUser();
  const reps = await db.user.findMany({
    where: { companyId: user.companyId, active: true, OR: [{ role: "SALES" }, { role: "ADMIN", onRepBoard: true }] },
    select: { id: true, name: true, title: true, role: true, photoAt: true, repReportUrl: true },
    orderBy: { name: "asc" },
  });
  const admins = await db.user.findMany({
    where: { companyId: user.companyId, active: true, role: "ADMIN" },
    select: { id: true, name: true, onRepBoard: true },
    orderBy: { name: "asc" },
  });
  const year = new Date().getFullYear();
  const stats = await repStats(user.companyId, reps.map((r) => r.id), new Date(year, 0, 1));

  const adminPicker = (
    <details className="card p-4 text-sm">
      <summary className="cursor-pointer font-medium">Admins shown here</summary>
      <p className="mt-2 text-slate-500">Sales reps are always listed. Tick the admins who also sell.</p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {admins.map((a) => (
          <form key={a.id} action={setOnRepBoard.bind(null, a.id, !a.onRepBoard)}>
            <button className="flex items-center gap-2">
              <input type="checkbox" readOnly checked={a.onRepBoard} tabIndex={-1} className="pointer-events-none" />
              {a.name}
            </button>
          </form>
        ))}
      </div>
    </details>
  );

  if (reps.length === 0) return <div className="space-y-4"><div className="card"><EmptyState>No sales reps on the team yet.</EmptyState></div>{adminPicker}</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Numbers are live from Mothership for {year} so far. Quote figures count quotes each rep wrote. Click a rep to open their SharePoint report.
      </p>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Rep</th>
              <th className="text-right">Accounts</th>
              <th className="text-right">Open pipeline</th>
              <th className="text-right">Quotes sent</th>
              <th className="text-right">Won</th>
              <th className="text-right">Win rate</th>
              <th>SharePoint report</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((r) => {
              const s = stats.get(r.id)!;
              const rate = winRate(s);
              const photo = photoUrl(r);
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/reports/reps/${r.id}`} className="flex items-center gap-3">
                      {photo ? (
                        <span className="h-9 w-9 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${photo})` }} />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{initials(r.name)}</span>
                      )}
                      <span>
                        <span className="link block font-medium">{r.name}</span>
                        <span className="text-xs text-slate-500">{r.title ?? (r.role === "ADMIN" ? "Admin" : "Sales rep")}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{s.accounts}</td>
                  <td className="text-right tabular-nums">
                    {dollars(s.openPipeline)}
                    <div className="text-xs text-slate-500">{s.openProjects} projects</div>
                  </td>
                  <td className="text-right tabular-nums">
                    {s.sentCount}
                    <div className="text-xs text-slate-500">{formatCents(s.sentCents)}</div>
                  </td>
                  <td className="text-right tabular-nums">
                    {s.wonCount}
                    <div className="text-xs text-slate-500">{formatCents(s.wonCents)}</div>
                  </td>
                  <td className="text-right tabular-nums">{rate === null ? <span className="text-slate-400">None yet</span> : `${rate}%`}</td>
                  <td>
                    {r.repReportUrl ? (
                      <Link href={`/reports/reps/${r.id}`} className="link">Open report</Link>
                    ) : (
                      <Link href={`/reports/reps/${r.id}`} className="text-slate-400 hover:text-slate-700">Add link</Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {adminPicker}
    </div>
  );
}
