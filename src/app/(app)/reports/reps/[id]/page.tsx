import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/quote-math";
import { canEmbed } from "@/lib/rep-report";
import { repStats, winRate } from "@/lib/rep-stats";
import { RepReportForm } from "../../forms";

const dollars = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default async function SalesRepPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const rep = await db.user.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, name: true, title: true, active: true, repReportUrl: true },
  });
  if (!rep) notFound();
  const year = new Date().getFullYear();
  const s = (await repStats(user.companyId, [rep.id], new Date(year, 0, 1))).get(rep.id)!;
  const rate = winRate(s);
  const embed = rep.repReportUrl && canEmbed(rep.repReportUrl);

  const tiles = [
    { label: "Accounts", value: String(s.accounts) },
    { label: "Open pipeline", value: dollars(s.openPipeline), note: `${s.openProjects} projects` },
    { label: `Quotes sent in ${year}`, value: String(s.sentCount), note: formatCents(s.sentCents) },
    { label: `Won in ${year}`, value: String(s.wonCount), note: formatCents(s.wonCents) },
    { label: "Win rate", value: rate === null ? "None yet" : `${rate}%`, note: rate === null ? undefined : `${s.wonCount} won, ${s.lostCount} lost` },
  ];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/reports/reps" className="text-sm text-slate-500 hover:text-slate-800">&larr; Sales reps</Link>
        <h2 className="text-lg font-semibold">{rep.name}{!rep.active && <span className="ml-2 text-sm font-normal text-slate-500">(removed from the team)</span>}</h2>
        {rep.title && <p className="text-sm text-slate-500">{rep.title}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{t.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{t.value}</div>
            {t.note && <div className="text-xs text-slate-500">{t.note}</div>}
          </div>
        ))}
      </div>

      {rep.repReportUrl && embed && (
        <div
          className="card mx-auto overflow-hidden"
          style={{ ["--w" as string]: "min(min(100vw, 80rem) - 2rem, (100vh - 12rem) * 16 / 9)", width: "var(--w)" }}
        >
          <iframe
            title={`${rep.name} report`}
            src={rep.repReportUrl}
            className="block w-full border-0 bg-white"
            style={{ height: "calc(var(--w) * 0.5625 + 2.5rem)" }}
            allowFullScreen
          />
        </div>
      )}
      {rep.repReportUrl && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span className="text-slate-600">
            {embed
              ? "If the report asks you to sign in, use your work Microsoft account."
              : "This SharePoint link opens in a new tab. To show the report right on this page, use an embed link instead (see below)."}
          </span>
          <a href={rep.repReportUrl} target="_blank" rel="noreferrer" className="btn btn-primary">Open in SharePoint ↗</a>
        </div>
      )}

      <section className="card space-y-3 p-5">
        <RepReportForm userId={rep.id} current={rep.repReportUrl} />
        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer">Showing the report on this page instead of a new tab</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><b>Excel file in SharePoint:</b> open it in Excel for the web, click File, then Share, then Embed, then Generate, and paste the embed code here.</li>
            <li><b>Power BI report:</b> paste the report&apos;s link or its File, Embed report, Website or portal link.</li>
            <li>Any other SharePoint link still works; it opens in a new tab. Clear the box and save to remove the link.</li>
          </ul>
        </details>
      </section>
    </div>
  );
}
