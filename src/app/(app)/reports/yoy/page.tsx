import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MONTHS, change, monthlyRevenue, powerBiLines, yearToDate, type Change, type MonthRevenue } from "@/lib/revenue";
import { parseRevenueSource } from "@/lib/powerbi-api";
import { RevenueMonthsForm, UploadRevenueForm } from "./forms";

const dollars = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;
const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const PREV = "#94a3b8";

// The small mark after a figure saying where it came from.
function SourceMark({ m }: { m: MonthRevenue }) {
  if (m.source === "POWERBI") return null;
  if (m.source === "UPLOAD") return <span className="ml-1 text-xs text-slate-400" title="From an uploaded file">↑</span>;
  if (m.source === "TYPED") return <span className="ml-1 text-xs text-slate-400" title="Typed in">✎</span>;
  return m.projects > 0 ? <span className="ml-1 text-xs text-slate-400" title="Won deals in Mothership">({m.projects})</span> : null;
}
const CUR = "#3b82f6";

function Delta({ c }: { c: Change }) {
  if (c.amount === 0) return <span className="text-slate-400">—</span>;
  const up = c.amount > 0;
  return (
    <span className={up ? "text-[#059669]" : "text-[#e11d48]"}>
      {up ? "▲" : "▼"} {dollars(Math.abs(c.amount))}
      {c.percent != null && <span className="ml-1 text-xs">({up ? "+" : "-"}{Math.abs(c.percent).toFixed(0)}%)</span>}
    </span>
  );
}

const OTHER = "Uploaded & typed";

export default async function YearOverYearPage({ searchParams }: { searchParams: Promise<{ year?: string; line?: string }> }) {
  const user = await requireUser();
  const now = new Date();
  const thisYear = now.getFullYear();
  const params = await searchParams;
  const asked = Number(params.year);
  const year = Number.isInteger(asked) && asked > 2000 && asked <= thisYear ? asked : thisYear;
  const prevYear = year - 1;

  const company = await db.company.findUniqueOrThrow({
    where: { id: user.companyId },
    select: { powerbiRevenue: true, powerbiSyncedAt: true, powerbiSyncResult: true },
  });
  const names = parseRevenueSource(company.powerbiRevenue)?.series.map((x) => x.name) ?? [];
  const [ownPrev, ownCur, entered, pbPrev, pbCur, pbCount] = await Promise.all([
    monthlyRevenue(user.companyId, prevYear),
    monthlyRevenue(user.companyId, year),
    db.revenueMonth.findMany({ where: { companyId: user.companyId }, orderBy: [{ year: "asc" }, { month: "asc" }] }),
    powerBiLines(user.companyId, names, prevYear),
    powerBiLines(user.companyId, names, year),
    db.powerBiRevenue.count({ where: { companyId: user.companyId } }),
  ]);
  const fromPowerBi = names.length > 0 && pbCount > 0;
  // A year in progress is compared through the current month only.
  const through = year === thisYear ? now.getMonth() + 1 : 12;

  // With Power BI, each revenue line gets a tab; typed or uploaded totals get their own tab if any exist.
  const lines = fromPowerBi
    ? [...names.map((name, i) => ({ name, prev: pbPrev[i].months, cur: pbCur[i].months })), ...(entered.length ? [{ name: OTHER, prev: ownPrev, cur: ownCur }] : [])]
    : [{ name: "", prev: ownPrev, cur: ownCur }];
  const line = lines.find((l) => l.name === params.line) ?? lines[0];
  const { prev, cur } = line;
  const href = (y: number, l: string) => `/reports/yoy?year=${y}${l ? `&line=${encodeURIComponent(l)}` : ""}`;
  const ytd = yearToDate(prev.map((m) => m.amount), cur.map((m) => m.amount), through);
  const max = Math.max(1, ...prev.slice(0, 12).map((m) => m.amount), ...cur.map((m) => m.amount));
  const formYears = [thisYear - 1, thisYear - 2, thisYear - 3, thisYear];
  const values: Record<number, (number | null)[]> = {};
  for (const y of formYears) values[y] = MONTHS.map((_, i) => entered.find((e) => e.year === y && e.month === i + 1)?.amount ?? null);
  const hasPrev = prev.some((m) => m.amount > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{year} vs {prevYear}</h2>
          <p className="text-sm text-slate-500">
            {fromPowerBi ? (
              <>
                Revenue by month from Power BI
                {company.powerbiSyncedAt && <>, last read {when.format(company.powerbiSyncedAt)}</>}.{" "}
                {company.powerbiSyncResult?.startsWith("Failed: ") && <span className="text-red-600">The last read failed. </span>}
                <Link href="/settings/powerbi" className="link">Power BI settings</Link>
              </>
            ) : (
              <>
                Revenue by month. <Link href="/settings/powerbi" className="link">Connect Power BI</Link> to fill this in automatically; until then
                it uses uploaded or typed totals, and won deals in Mothership for other months.
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {[thisYear - 2, thisYear - 1, thisYear].map((y) => (
            <Link key={y} href={href(y, line.name)} className={`btn ${y === year ? "border-brand-500 text-brand-700" : ""}`}>
              {y} vs {y - 1}
            </Link>
          ))}
        </div>
      </div>

      {fromPowerBi ? (
        <div className={`grid gap-4 ${lines.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {lines.map((l) => {
            const t = yearToDate(l.prev.map((m) => m.amount), l.cur.map((m) => m.amount), through);
            const active = l.name === line.name;
            return (
              <Link key={l.name} href={href(year, l.name)} className={`card block p-4 hover:border-brand-500 ${active ? "border-brand-500 ring-1 ring-brand-500" : ""}`}>
                <div className="text-xs uppercase tracking-wide text-slate-500">{l.name}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{dollars(t.after)}</div>
                <div className="mt-1 text-sm tabular-nums">
                  <Delta c={t} /> <span className="text-slate-500">vs {dollars(t.before)} {year === thisYear ? `through ${MONTHS[through - 1]} ${prevYear}` : prevYear}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{year === thisYear ? `${year} through ${MONTHS[through - 1]}` : year}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{dollars(ytd.after)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{year === thisYear ? `${prevYear} same months` : prevYear}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{dollars(ytd.before)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Change</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums"><Delta c={ytd} /></div>
          </div>
        </div>
      )}

      {fromPowerBi && <h3 className="font-semibold">{line.name} by month</h3>}

      {!hasPrev && (
        <div className="card border-amber-300 p-4 text-sm">
          There are no {prevYear} numbers yet, so every change shows as new money.{" "}
          {fromPowerBi ? `Power BI has no ${prevYear} figures for ${line.name}.` : `Connect Power BI, upload an export, or enter ${prevYear}'s totals below.`}
        </div>
      )}

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PREV }} />{prevYear}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CUR }} />{year}</span>
        </div>
        <div className="flex h-48 items-end gap-1 sm:gap-2">
          {MONTHS.map((m, i) => (
            <div key={m} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <div className="flex h-full items-end justify-center gap-0.5">
                <div className="w-1/2 max-w-5 rounded-t" style={{ height: `${(prev[i].amount / max) * 100}%`, background: PREV }} title={`${m} ${prevYear}: ${dollars(prev[i].amount)}`} />
                <div className="w-1/2 max-w-5 rounded-t" style={{ height: `${(cur[i].amount / max) * 100}%`, background: CUR, opacity: i < through ? 1 : 0.35 }} title={`${m} ${year}: ${dollars(cur[i].amount)}`} />
              </div>
              <div className="mt-1 text-center text-xs text-slate-500">{m}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table tabular-nums">
          <thead>
            <tr>
              <th>Month</th>
              <th className="text-right">{prevYear}</th>
              <th className="text-right">{year}</th>
              <th className="text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((m, i) => {
              const future = i >= through;
              return (
                <tr key={m} className={future ? "text-slate-400" : ""}>
                  <td>{m}</td>
                  <td className="text-right">
                    {dollars(prev[i].amount)}
                    <SourceMark m={prev[i]} />
                  </td>
                  <td className="text-right">
                    {future && cur[i].amount === 0 ? "—" : dollars(cur[i].amount)}
                    {!(future && cur[i].amount === 0) && <SourceMark m={cur[i]} />}
                  </td>
                  <td className="text-right">{future ? "" : <Delta c={change(prev[i].amount, cur[i].amount)} />}</td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td>{year === thisYear ? "Year to date" : "Year"}</td>
              <td className="text-right">{dollars(ytd.before)}</td>
              <td className="text-right">{dollars(ytd.after)}</td>
              <td className="text-right"><Delta c={ytd} /></td>
            </tr>
          </tbody>
        </table>
      </div>
      {!(fromPowerBi && line.name !== OTHER) && <p className="text-xs text-slate-500">
        ↑ is from an uploaded file, ✎ typed in. A number in brackets is how many won deals in Mothership make up the month.
      </p>}

      <details className="card p-5" open={!hasPrev && !fromPowerBi}>
        <summary className="cursor-pointer font-semibold">Upload a Power BI export{fromPowerBi && ` (shows under ${OTHER})`}</summary>
        <p className="mt-2 mb-4 text-sm text-slate-500">
          In Power BI, hover over a revenue table or chart, click ⋯, then <b>Export data</b>, and save it as Excel or CSV. Upload it here. Any table with a
          date (or Year and Month) and an amount works, including a matrix with months across.
        </p>
        <UploadRevenueForm />
      </details>

      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">Enter monthly totals{fromPowerBi && ` (shows under ${OTHER})`}</summary>
        <p className="mt-2 mb-4 text-sm text-slate-500">
          For years before Mothership, type each month&apos;s revenue, or copy a column of 12 months from Excel and paste it into January.
        </p>
        <RevenueMonthsForm years={formYears} values={values} />
      </details>
    </div>
  );
}
