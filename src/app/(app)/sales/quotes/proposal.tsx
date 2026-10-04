/* eslint-disable @next/next/no-img-element */
import { formatCents, lineDetail } from "@/lib/quote-math";
import { fillPlaceholders, toListItems } from "@/lib/quote-template";

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

  return (
    <div className="proposal space-y-6">
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

      <Page logo={logo}>
        <p className="mb-8 text-center font-sans text-lg font-semibold text-blue-800 underline">Financial Investment</p>
        <p className="mb-6 italic underline">{q.investmentHeading}</p>
        <div className="space-y-2">
          {q.lines.map((l) => {
            const detail = lineDetail(l);
            return (
              <p key={l.id}>
                {l.description}: {formatCents(l.amountCents)}
                {detail && <> ({detail})</>}
              </p>
            );
          })}
        </div>
        <p className="mt-6 text-center font-bold italic">
          {q.totalLabel}: {formatCents(q.totalCents)}
        </p>
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
