/* eslint-disable @next/next/no-img-element */
import { formatCents, lineDetail } from "@/lib/quote-math";
import { fillPlaceholders, toListItems } from "@/lib/quote-template";
import { crewHeadline, crewLabel, crewRateCents, dayLaborCents, dayName, materialAmountCents, planInvestmentRows, readPlan, type PlanDayT, type PlanMaterialT } from "@/lib/quote-plan";

// The client-facing proposal, laid out like Apple Moving's Word "Project Recommendation Plan":
// cover, scope, financial investment, billing confirmation, terms. Each page breaks when printed.

export type ProposalData = {
  title: string;
  quoteDate: Date;
  recipientName: string | null;
  recipientTitle: string | null;
  recipientCompany: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  clientLogo: string | null;
  clientLabel: string;
  serviceDescription: string;
  intro: string;
  scopeTitle: string;
  timeline: string | null;
  scope: string | null;
  investmentHeading: string;
  totalLabel: string;
  valuation: string;
  optionalValuation: string | null;
  companyDuties: string;
  clientDuties: string;
  totalCents: number;
  lines: { id: string; description: string; quantity: number; unit: string; rateCents: number; amountCents: number; note: string | null }[];
  plan?: unknown;
  company: { name: string; displayName: string | null; logo: string | null };
  preparedBy: { name: string; title: string | null; signature: string | null };
};

function longDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function shortDate(d: Date) {
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}.${d.getUTCFullYear()}`;
}

function Page({ logo, children, last = false }: { logo: string | null; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={`proposal-page relative bg-white px-14 pb-14 pt-24 font-serif text-[13px] leading-relaxed text-black shadow ${last ? "" : "proposal-break"}`}>
      {logo && <img src={logo} alt="" className="absolute right-12 top-8 h-14 max-w-48 object-contain" />}
      {children}
    </section>
  );
}

// Lines starting with a bullet become lists; blank lines separate paragraphs.
function RichText({ text }: { text: string | null }) {
  if (!text) return null;
  const blocks: { type: "p" | "ul"; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[•\-*]\s+/.test(line);
    if (!line.trim()) {
      blocks.push({ type: "p", lines: [] });
      continue;
    }
    const type = bullet ? "ul" : "p";
    const last = blocks.at(-1);
    const content = bullet ? line.replace(/^\s*[•\-*]\s+/, "") : line;
    if (last && last.type === type && (type === "ul" || last.lines.length > 0)) last.lines.push(content);
    else blocks.push({ type, lines: [content] });
  }
  return (
    <div className="space-y-3">
      {blocks
        .filter((b) => b.lines.length)
        .map((b, i) =>
          b.type === "ul" ? (
            <ul key={i} className="list-disc space-y-0.5 pl-6">
              {b.lines.map((l, j) => <li key={j}>{l}</li>)}
            </ul>
          ) : (
            <p key={i}>
              {b.lines.map((l, j) => (
                <span key={j}>
                  {l}
                  {j < b.lines.length - 1 && <br />}
                </span>
              ))}
            </p>
          ),
        )}
    </div>
  );
}


// Label / value rows that line up in one column, like tab stops in the Word proposal.
function Aligned({ rows, labelWidth = "9rem" }: { rows: [React.ReactNode, React.ReactNode][]; labelWidth?: string }) {
  return (
    <div className="grid gap-x-3" style={{ gridTemplateColumns: `${labelWidth} 1fr` }}>
      {rows.map(([l, v], i) => (
        <div key={i} className="contents">
          <div>{l}</div>
          <div>{v}</div>
        </div>
      ))}
    </div>
  );
}

function DayBlock({ day, index, count }: { day: PlanDayT; index: number; count: number }) {
  const facts: [string, string][] = (
    [
      ["Date:", day.date],
      ["Start Time:", day.startTime],
      [day.destination ? "Origin:" : "Address:", day.origin],
      ["Destination:", day.destination],
    ] as [string, string][]
  ).filter(([, v]) => v.trim());
  const scope = toListItems(day.scope);
  return (
    <div className="mb-8 break-inside-avoid">
      <p className="mb-2 font-bold italic underline">{dayName(day, index, count)}</p>
      {facts.length > 0 && <Aligned rows={facts} labelWidth="7rem" />}
      {scope.length > 0 && (
        <>
          <p className="mt-2">Scope:</p>
          <ul className="list-[square] space-y-0.5 pl-10">
            {scope.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}
      {day.crew.length > 0 && (
        <>
          <p className="mt-3 font-bold text-red-700 underline">{crewHeadline(day)}</p>
          <div className="mt-1">
            <Aligned rows={day.crew.map((c) => [crewLabel(c), `${formatCents(c.rateCents)}/per hour each`])} labelWidth="14rem" />
          </div>
          <p className="mt-2 pl-[14rem]">
            → Hourly Rate: {formatCents(crewRateCents(day.crew))} &nbsp;x {day.hours} hours = {formatCents(dayLaborCents(day))}
          </p>
        </>
      )}
    </div>
  );
}

function materialLabel(m: PlanMaterialT): string {
  const noQty = m.unit === "flat" || /fuel|fee|surcharge/i.test(m.name);
  return noQty ? `${m.name}:` : `(${m.quantity}) ${m.name}:`;
}

function materialValue(m: PlanMaterialT): string {
  if (m.free) return "Free Rental";
  const per = !m.unit || m.unit === "each" ? "each" : `per ${m.unit}`;
  const base = `${formatCents(m.rateCents)}/${per} (${formatCents(materialAmountCents(m))})`;
  return m.note ? `${base} – ${m.note}` : base;
}

// Money in one right-aligned column with the dollar sign next to the number.
function MoneyRows({ rows }: { rows: { label: string; cents: number }[] }) {
  return (
    <div className="grid max-w-xl gap-y-0.5" style={{ gridTemplateColumns: "1fr 8rem" }}>
      {rows.map((r, i) => (
        <div key={i} className="contents">
          <div>{r.label}</div>
          <div className="text-right tabular-nums">{formatCents(r.cents)}</div>
        </div>
      ))}
    </div>
  );
}

function Blank({ label, wide = false }: { label: string; wide?: boolean }) {
  return (
    <div className="flex items-end gap-2">
      <span className="whitespace-nowrap">{label}</span>
      <span className={`border-b border-black ${wide ? "flex-1" : "w-64"}`}>&nbsp;</span>
    </div>
  );
}

export function Proposal({ q }: { q: ProposalData }) {
  const companyName = q.company.displayName || q.company.name;
  const fill = (t: string) => fillPlaceholders(t, { company: companyName, service: q.serviceDescription });
  const logo = q.company.logo;
  const plan = readPlan(q.plan);
  const investmentRows = [
    ...planInvestmentRows(plan).map((r) => ({ label: `${r.label}:`, cents: r.amountCents })),
    ...q.lines.map((l) => {
      const detail = lineDetail(l);
      return { label: `${l.description}:${detail ? ` (${detail})` : ""}`, cents: l.amountCents };
    }),
  ];

  return (
    <div className="proposal theme-light space-y-6">
      <Page logo={logo}>
        <div className="space-y-0.5">
          <p>{shortDate(q.quoteDate)}</p>
          <div className="pt-4">
            {q.recipientName && <p>{q.recipientName}</p>}
            {q.recipientTitle && <p>{q.recipientTitle}</p>}
            {q.recipientCompany && <p>{q.recipientCompany}</p>}
            {q.recipientPhone && <p>{q.recipientPhone}</p>}
            {q.recipientEmail && <p className="text-blue-700 underline">{q.recipientEmail}</p>}
          </div>
        </div>
        <div className="mt-24 text-center font-sans">
          <p className="text-lg font-semibold tracking-wide">PROJECT RECOMMENDATION PLAN</p>
          <p className="text-xs">FOR</p>
          <div className="my-12 flex min-h-20 items-center justify-center">
            {q.clientLogo ? (
              <img src={q.clientLogo} alt={q.clientLabel} className="max-h-24 max-w-72 object-contain" />
            ) : (
              <p className="text-2xl font-semibold">{q.recipientCompany || q.clientLabel}</p>
            )}
          </div>
          <p>{longDate(q.quoteDate)}</p>
          <p className="mt-2 font-semibold">{companyName}</p>
        </div>
        <div className="mt-16 font-sans">
          <p className="font-bold">PREPARED BY</p>
          {q.preparedBy.signature ? (
            <img src={q.preparedBy.signature} alt="" className="my-3 h-12 object-contain" />
          ) : (
            <div className="h-12" />
          )}
          <p className="text-xs">{q.preparedBy.name}</p>
        </div>
      </Page>

      <Page logo={logo}>
        <p className="mb-6">{fill(q.intro)}</p>
        <p className="mb-4 font-semibold underline">{q.scopeTitle}</p>
        {q.timeline && <p className="mb-4">Proposed Timeline: {q.timeline}</p>}
        <RichText text={q.scope} />
      </Page>

      {(plan.days.length > 0 || plan.materials.length > 0) && (
        <Page logo={logo}>
          {plan.days.map((d, i) => <DayBlock key={i} day={d} index={i} count={plan.days.length} />)}
          {plan.materials.length > 0 && (
            <div className="break-inside-avoid">
              <p className="mb-1 font-bold italic text-red-700 underline">Materials and Equipment:</p>
              <Aligned rows={plan.materials.map((m) => [materialLabel(m), materialValue(m)])} labelWidth="14rem" />
            </div>
          )}
        </Page>
      )}

      <Page logo={logo}>
        <p className="mb-8 text-center font-sans text-lg font-semibold text-blue-800 underline">Financial Investment</p>
        <p className="mb-6 italic underline">{q.investmentHeading}</p>
        <MoneyRows rows={investmentRows} />
        <div className="mt-2 max-w-xl">
          <div className="ml-auto w-32 border-t border-black" />
          <div className="mt-2 grid" style={{ gridTemplateColumns: "1fr 8rem" }}>
            <div>{q.totalLabel}:</div>
            <div className="text-right tabular-nums">{formatCents(q.totalCents)}</div>
          </div>
        </div>
        {plan.assumptions.trim() && (
          <div className="mt-8">
            <p className="mb-2 font-bold underline">Assumptions and Exclusions:</p>
            <RichText text={fill(plan.assumptions)} />
          </div>
        )}
        <div className="mt-28 grid grid-cols-2 gap-8 text-xs">
          <Blank label="TITLE:" wide />
          <Blank label="PRINTED NAME:" wide />
        </div>
        <p className="mt-4 text-xs">
          <span className="mr-4 font-semibold">VALUATION:</span>
          {fill(q.valuation)}
        </p>
        {q.optionalValuation && <p className="mt-4 text-xs">❑ {fill(q.optionalValuation)}</p>}
      </Page>

      <Page logo={logo}>
        <p className="font-semibold text-blue-800 underline">Billing Address Confirmation</p>
        <p className="mb-10">Please complete the information below.</p>
        <div className="space-y-8">
          <Blank label="Point of Contact:" wide />
          <Blank label="Phone Number:" wide />
          <Blank label="Email:" wide />
        </div>
        <p className="mb-8 mt-12 font-semibold text-blue-800 underline">Company Billing Address:</p>
        <div className="space-y-8">
          <Blank label="Company Name:" wide />
          <Blank label="Billing Street Address:" wide />
          <Blank label="City, State, Zip Code:" wide />
        </div>
      </Page>

      <Page logo={logo} last>
        <p className="mb-4 font-semibold italic text-blue-800 underline">Terms and Conditions</p>
        <p className="mb-2 font-bold">{companyName}&rsquo;s Responsibilities:</p>
        <ul className="mb-6 list-disc space-y-1 pl-8">
          {toListItems(q.companyDuties).map((d, i) => <li key={i}>{fill(d)}</li>)}
        </ul>
        <p className="mb-2 font-bold">{q.clientLabel} Responsibilities:</p>
        <ul className="mb-10 list-disc space-y-1 pl-8">
          {toListItems(q.clientDuties).map((d, i) => <li key={i}>{fill(d)}</li>)}
        </ul>
        <p className="text-xs">Best Regards,</p>
        <div className="mt-2 flex items-end justify-between text-xs">
          <div>
            {q.preparedBy.signature ? <img src={q.preparedBy.signature} alt="" className="mb-2 h-12 object-contain" /> : <div className="h-14" />}
            <p>{q.preparedBy.name}</p>
            {q.preparedBy.title && <p>{q.preparedBy.title}</p>}
          </div>
          <div className="w-56 text-center">
            <div className="border-b border-dashed border-black">&nbsp;</div>
            <p>Client Signature</p>
          </div>
        </div>
      </Page>
    </div>
  );
}
