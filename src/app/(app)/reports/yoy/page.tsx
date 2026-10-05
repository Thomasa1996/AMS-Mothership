import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseRevenueSource } from "@/lib/powerbi-api";
import { DEFAULT_LINES, MONTHS, TOTAL_LINE, change, isIgnoredLine, revenueLines, totalLine, yearToDate, type Change, type Line, type MonthRevenue } from "@/lib/revenue";
import { PasteRevenueForm, RevenueMonthsForm, UploadRevenueForm } from "./forms";

// The comparisons offered: each year against the one before, from 2025 vs 2024.
const FIRST_YEAR = 2025;

const dollars = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;
const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const PREV = "#94a3b8";
const CUR = "#3b82f6";

// A mark after a figure that was typed in by hand.
function SourceMark({ m }: { m: MonthRevenue }) {
  if (m.source === "TYPED") return <span className="ml-1 text-xs text-slate-400" title="Typed in">✎</span>;
  return null;
}

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

export default async function YearOverYearPage({ searchParams }: { searchParams: Promise<{ year?: string; line?: string }> }) {
  const user = await requireUser();
  const now = new Date();
  const thisYear = now.getFullYear();
  const params = await searchParams;
  const years = Array.from({ length: Math.max(1, thisYear - FIRST_YEAR + 1) }, (_, i) => FIRST_YEAR + i);
  const asked = Number(params.year);
  const year = years.includes(asked) ? asked : years[years.length - 1];
  const prevYear = year - 1;

  const [company, entrySeries] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: user.companyId }, select: { powerbiRevenue: true, powerbiSyncedAt: true, powerbiSyncResult: true } }),
    db.revenueEntry.findMany({ where: { companyId: user.companyId }, distinct: ["series"], select: { series: true } }),
  ]);
  const pbNames = parseRevenueSource(company.powerbiRevenue)?.series.map((x) => x.name) ?? [];
  const base = pbNames.length ? pbNames : DEFAULT_LINES;
  const names = [...base, ...entrySeries.map((e) => e.series).filter((n) => !base.includes(n) && !isIgnoredLine(n))];

  const [prevLines, curLines] = await Promise.all([revenueLines(user.companyId, names, prevYear), revenueLines(user.companyId, names, year)]);
  // Commercial Revenue is the total of its types, shown first.
  const all: { name: string; prev: Line; cur: Line }[] = [
    ...(names.length > 1 ? [{ name: TOTAL_LINE, prev: totalLine(TOTAL_LINE, prevLines), cur: totalLine(TOTAL_LINE, curLines) }] : []),
    ...names.map((name, i) => ({ name, prev: prevLines[i], cur: curLines[i] })),
  ];
  const line = all.find((l) => l.name === params.line) ?? all[0];
  const prev = line.prev.months;
  const cur = line.cur.months;

  // A year in progress is compared through the last full month; the current month shows as in progress.
  const inProgress = year === thisYear ? now.getMonth() + 1 : 0;
  const through = year === thisYear ? Math.max(1, now.getMonth()) : 12;
  const ytd = yearToDate(prev.map((m) => m.amount), cur.map((m) => m.amount), through);
  const max = Math.max(1, ...prev.map((m) => m.amount), ...cur.map((m) => m.amount));
  const hasData = (l: Line) => l.months.some((m) => m.source);
  const missing = [...(!all.some((l) => hasData(l.prev)) ? [prevYear] : []), ...(!all.some((l) => hasData(l.cur)) ? [year] : [])];

  const formYears = [FIRST_YEAR - 1, ...years];
  const entries = await db.revenueEntry.findMany({ where: { companyId: user.companyId, year: { in: formYears } } });
  const values: Record<string, (number | null)[]> = {};
  for (const n of names) for (const y of formYears) values[`${n}|${y}`] = MONTHS.map((_, i) => entries.find((e) => e.series === n && e.year === y && e.month === i + 1)?.amount ?? null);
  const href = (y: number, l: string) => `/reports/yoy?year=${y}&line=${encodeURIComponent(l)}`;
  const span = year === thisYear ? `Jan to ${MONTHS[through - 1]}` : "full year";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{year} vs {prevYear}</h2>
          <p className="text-sm text-slate-500">
            {pbNames.length ? (
              <>
                From Power BI{company.powerbiSyncedAt && <>, last read {when.format(company.powerbiSyncedAt)}</>}.{" "}
                {company.powerbiSyncResult?.startsWith("Failed: ") && <span className="text-red-600">The last read failed. </span>}
                <Link href="/settings/powerbi" className="link">Power BI settings</Link>
              </>
            ) : (
              <>
                From numbers pasted below. <Link href="/settings/powerbi" className="link">Connect Power BI</Link> to keep them current automatically.
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {years.map((y) => (
            <Link key={y} href={href(y, line.name)} className={`btn ${y === year ? "border-brand-500 text-brand-700" : ""}`}>
              {y} vs {y - 1}
            </Link>
          ))}
        </div>
      </div>

      {missing.length > 0 && (
        <div className="card border-amber-300 p-4 text-sm">
          No revenue for {missing.join(" or ")} yet. Paste it from Power BI below.
        </div>
      )}

      <div className={`grid gap-4 ${all.length >= 3 ? "sm:grid-cols-3" : all.length === 2 ? "sm:grid-cols-2" : ""}`}>
        {all.map((l) => {
          const t = yearToDate(l.prev.months.map((m) => m.amount), l.cur.months.map((m) => m.amount), through);
          const active = l.name === line.name;
          return (
            <Link key={l.name} href={href(year, l.name)} className={`card block p-4 hover:border-brand-500 ${active ? "border-brand-500 ring-1 ring-brand-500" : ""}`}>
              <div className="text-xs uppercase tracking-wide text-slate-500">{l.name}, {year} {span}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{dollars(t.after)}</div>
              <div className="mt-1 text-sm tabular-nums">
                <Delta c={t} /> <span className="text-slate-500">vs {dollars(t.before)} in {prevYear}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <h3 className="font-semibold">{line.name} by month</h3>

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PREV }} />{prevYear}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CUR }} />{year}</span>
        </div>
        <div className="flex h-48 items-end gap-1 sm:gap-2">
          {MONTHS.map((m, i) => (
            <div key={m} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <div className="flex h-full items-end justify-center gap-0.5">
                <div className="w-1/2 max-w-5 rounded-t" style={{ height: `${(Math.max(0, prev[i].amount) / max) * 100}%`, background: PREV }} title={`${m} ${prevYear}: ${dollars(prev[i].amount)}`} />
                <div
                  className="w-1/2 max-w-5 rounded-t"
                  style={{ height: `${(Math.max(0, cur[i].amount) / max) * 100}%`, background: CUR, opacity: i < through ? 1 : 0.35 }}
                  title={`${m} ${year}: ${dollars(cur[i].amount)}`}
                />
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
              const counted = i < through;
              const current = i + 1 === inProgress;
              const blank = !counted && !cur[i].source;
              return (
                <tr key={m} className={counted ? "" : "text-slate-400"}>
                  <td>
                    {m}
                    {current && <span className="ml-2 text-xs">in progress</span>}
                  </td>
                  <td className="text-right">
                    {dollars(prev[i].amount)}
                    <SourceMark m={prev[i]} />
                  </td>
                  <td className="text-right">
                    {blank ? "—" : dollars(cur[i].amount)}
                    {!blank && <SourceMark m={cur[i]} />}
                  </td>
                  <td className="text-right">{counted ? <Delta c={change(prev[i].amount, cur[i].amount)} /> : ""}</td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td>{year === thisYear ? `Jan to ${MONTHS[through - 1]}` : "Year"}</td>
              <td className="text-right">{dollars(ytd.before)}</td>
              <td className="text-right">{dollars(ytd.after)}</td>
              <td className="text-right"><Delta c={ytd} /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        {year === thisYear && `Totals compare full months only, so ${MONTHS[inProgress - 1]} counts once it ends. `}✎ marks a month typed in by hand.
      </p>

      <details className="card p-5" open={!pbNames.length}>
        <summary className="cursor-pointer font-semibold">Paste numbers from Power BI</summary>
        <p className="mt-2 mb-4 text-sm text-slate-500">
          In Power BI, select the revenue table (Category, Month, Type, Sum of Amount), copy it, and paste it here. Pick the year it covers. Budget rows are
          skipped, and pasting a year again replaces its months.
        </p>
        <PasteRevenueForm years={formYears} defaultYear={year} />
      </details>

      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">Upload a Power BI export</summary>
        <p className="mt-2 mb-4 text-sm text-slate-500">
          In Power BI, click ⋯ on the revenue table, then <b>Export data</b>, and save it as Excel or CSV. Pick the year it covers unless the file has a Year column.
        </p>
        <UploadRevenueForm years={formYears} defaultYear={year} />
      </details>

      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">Type or fix monthly totals</summary>
        <div className="mt-4">
          <RevenueMonthsForm lines={names} years={[...formYears].reverse()} values={values} />
        </div>
      </details>
    </div>
  );
}
