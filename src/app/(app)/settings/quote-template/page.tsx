import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { templateFor } from "@/lib/quote-template";
import { PageHeader } from "@/components/ui";
import { saveTemplate } from "../actions";
import { ImageInput, SettingsForm } from "../forms";

function Area({ name, label, value, rows = 4 }: { name: string; label: string; value: string; rows?: number }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <textarea className="input" id={name} name={name} rows={rows} defaultValue={value} />
    </div>
  );
}

export default async function QuoteTemplatePage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/settings/profile");
  const c = user.company;
  const t = templateFor(c);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Quote template"
        subtitle="New quotes start from this. Use {company} and {service} where those names should appear."
      />
      <div className="card p-5">
        <SettingsForm action={saveTemplate}>
          <div>
            <label className="label" htmlFor="displayName">Company name on quotes</label>
            <input className="input" id="displayName" name="displayName" defaultValue={c.displayName ?? c.name} />
          </div>
          <ImageInput name="logo" label="Logo (top right of every page)" defaultValue={c.logo} hint="PNG with a transparent background works best." />
          <Area name="quoteIntro" label="Introduction" value={t.intro} rows={3} />
          <div>
            <label className="label" htmlFor="quoteInvestmentHeading">Financial investment heading</label>
            <input className="input" id="quoteInvestmentHeading" name="quoteInvestmentHeading" defaultValue={t.investmentHeading} />
          </div>
          <Area name="quoteValuation" label="Valuation" value={t.valuation} rows={6} />
          <Area name="quoteOptionalValuation" label="Optional full replacement valuation" value={t.optionalValuation} rows={4} />
          <Area name="quoteCompanyDuties" label="Our responsibilities (one per line)" value={t.companyDuties} rows={9} />
          <Area name="quoteClientDuties" label="Client responsibilities (one per line)" value={t.clientDuties} rows={9} />
        </SettingsForm>
      </div>
    </div>
  );
}
