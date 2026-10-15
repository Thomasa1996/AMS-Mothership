import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { quoteScope } from "@/lib/access";
import { toListItems } from "@/lib/quote-template";
import { crewLabel, crewPeople, dayName, readPlan } from "@/lib/quote-plan";
import { PrintButton } from "../print-button";

// The crew's work order, generated from the quote's schedule: job header, site requirements, crew roster,
// equipment, a checklist per day and sign-off. Prints on its own.
export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const quote = await db.quote.findFirst({ where: { id, ...quoteScope(user) }, include: { createdBy: true, company: true } });
  if (!quote) notFound();
  const plan = readPlan(quote.plan);
  const company = quote.company.displayName || quote.company.name;

  // The roster needs the most people of each role on any one day.
  const roster = new Map<string, number>();
  for (const d of plan.days) for (const c of d.crew) roster.set(c.role, Math.max(roster.get(c.role) ?? 0, c.count));
  const rosterRows = [...roster.entries()].flatMap(([role, n]) => Array.from({ length: n }, () => role));

  const contact = [quote.recipientName, quote.recipientTitle, quote.recipientCompany, quote.recipientPhone, quote.recipientEmail].filter(Boolean).join(" · ");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Work order: quote #{quote.number}</h1>
          <p className="mt-1 text-sm text-slate-500">For the crew. Built from the quote&rsquo;s schedule, crew and materials.</p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          <Link href={`/sales/quotes/${quote.id}`} className="btn">Back to quote</Link>
        </div>
      </div>

      {plan.days.length === 0 ? (
        <div className="card p-6 text-sm text-slate-600">Add a day-by-day schedule to the quote to generate its work order.</div>
      ) : (
        <div className="theme-light mx-auto max-w-4xl space-y-6 bg-white p-10 text-[13px] leading-relaxed text-black shadow print:p-0 print:shadow-none">
          <header>
            <p className="text-2xl font-bold">WORK ORDER</p>
            <p className="font-semibold text-red-700">{quote.title}</p>
            <dl className="mt-4 grid gap-x-4 gap-y-1" style={{ gridTemplateColumns: "11rem 1fr" }}>
              <dt className="font-semibold">Quote</dt>
              <dd>#{quote.number}</dd>
              <dt className="font-semibold">Client contact</dt>
              <dd>{contact || "—"}</dd>
              <dt className="font-semibold">{company} sales contact</dt>
              <dd>{[quote.createdBy.name, quote.createdBy.title].filter(Boolean).join(", ")}</dd>
              <dt className="font-semibold">Schedule</dt>
              <dd>
                {plan.days.length} working {plan.days.length === 1 ? "day" : "days"}
                {plan.days[0]?.date && ` · starting ${plan.days[0].date}`}
              </dd>
            </dl>
          </header>

          {plan.assumptions.trim() && (
            <section>
              <H>Site requirements and assumptions – read before Day 1</H>
              <ul className="list-disc space-y-0.5 pl-6">
                {toListItems(plan.assumptions).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </section>
          )}

          {rosterRows.length > 0 && (
            <section className="break-inside-avoid">
              <H>Crew roster</H>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-red-700 text-white">
                    <th className="border border-slate-400 px-2 py-1">Role</th>
                    <th className="border border-slate-400 px-2 py-1">Name</th>
                    <th className="w-36 border border-slate-400 px-2 py-1">U.S. citizen verified</th>
                    <th className="w-28 border border-slate-400 px-2 py-1">Badge #</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterRows.map((role, i) => (
                    <tr key={i}>
                      <td className="border border-slate-400 px-2 py-1">{role}</td>
                      <td className="border border-slate-400 px-2 py-1" />
                      <td className="border border-slate-400 px-2 py-1 text-center">☐</td>
                      <td className="border border-slate-400 px-2 py-1" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {plan.materials.length > 0 && (
            <section className="break-inside-avoid">
              <H>Equipment and materials to load</H>
              <ul className="space-y-0.5">
                {plan.materials.map((m, i) => (
                  <li key={i}>
                    ☐ ({m.quantity}) {m.name}
                    {m.unit && m.unit !== "each" && m.unit !== "flat" ? ` · ${m.unit}` : ""}
                    {m.note ? ` – ${m.note}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.days.map((d, i) => (
            <section key={i} className="break-inside-avoid border-t border-slate-300 pt-4">
              <H>{dayName(d, i, plan.days.length)}</H>
              <dl className="grid gap-x-4 gap-y-0.5" style={{ gridTemplateColumns: "8rem 1fr" }}>
                <dt className="font-semibold">Date</dt>
                <dd>{d.date || "TBD"}</dd>
                <dt className="font-semibold">Start time</dt>
                <dd>{d.startTime || "TBD"}</dd>
                {d.origin && (
                  <>
                    <dt className="font-semibold">{d.destination ? "Origin" : "Address"}</dt>
                    <dd>{d.origin}</dd>
                  </>
                )}
                {d.destination && (
                  <>
                    <dt className="font-semibold">Destination</dt>
                    <dd>{d.destination}</dd>
                  </>
                )}
                <dt className="font-semibold">Crew</dt>
                <dd>
                  {crewPeople(d.crew)} people: {d.crew.map(crewLabel).join(", ")}
                </dd>
                <dt className="font-semibold">Trucks</dt>
                <dd>{d.trucks ? `${d.trucks} × ${d.truckLabel || "truck"}` : "None"}{d.loads ? ` · est. ${d.loads} truckloads out` : ""}</dd>
                <dt className="font-semibold">Hours</dt>
                <dd>{d.hours} including travel</dd>
              </dl>
              {toListItems(d.scope).length > 0 && (
                <>
                  <p className="mt-2 font-semibold">Tasks</p>
                  <ul className="space-y-0.5">
                    {toListItems(d.scope).map((s, j) => <li key={j}>☐ {s}</li>)}
                    <li>☐ Daily activity report sent to the client contact by end of day</li>
                  </ul>
                </>
              )}
              <p className="mt-3 text-xs">Supervisor initials: ________ &nbsp; Client rep: ____________________ &nbsp; Time complete: ________</p>
            </section>
          ))}

          <section className="break-inside-avoid border-t border-slate-300 pt-4">
            <H>Sign-off</H>
            <div className="grid grid-cols-2 gap-10 pt-6">
              {[`${company} supervisor`, "Client representative"].map((who) => (
                <div key={who}>
                  <div className="border-b border-black">&nbsp;</div>
                  <p className="text-xs">{who} – signature and date</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[15px] font-bold text-red-700">{children}</p>;
}
