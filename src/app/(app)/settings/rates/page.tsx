import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { deleteRate, saveRate, saveRateNotes } from "../actions";
import { NotesForm, RateRowForm } from "../forms";

export default async function RateCardSettingsPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/sales/rates");
  const rates = await db.rateItem.findMany({ where: { companyId: user.companyId }, orderBy: [{ position: "asc" }, { name: "asc" }] });
  const categories = [...new Set(rates.map((r) => r.category))];

  return (
    <div className="space-y-6">
      <PageHeader title="Rate card" subtitle={`${rates.length} standard rates. Each market's prices are set on its Warehouses page; changing a standard rate here doesn't change them.`} />
      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Add a rate</h2>
        <RateRowForm action={saveRate.bind(null, null)} categories={categories} />
      </section>
      {categories.map((category) => (
        <section key={category} className="card p-4">
          <h2 className="mb-3 font-semibold">{category}</h2>
          <div className="space-y-2">
            {rates
              .filter((r) => r.category === category)
              .map((r) => (
                <div key={r.id} className={`flex items-start gap-2 ${r.active ? "" : "opacity-60"}`}>
                  <div className="flex-1">
                    <RateRowForm
                      action={saveRate.bind(null, r.id)}
                      categories={categories}
                      row={{
                        id: r.id,
                        category: r.category,
                        name: r.name,
                        unit: r.unit,
                        rate: (r.rateCents / 100).toFixed(2),
                        notes: r.notes ?? "",
                        active: r.active,
                      }}
                    />
                  </div>
                  <ConfirmButton
                    action={deleteRate.bind(null, r.id)}
                    label="Delete"
                    confirmText={`Delete ${r.name}? Existing quotes keep their prices.`}
                    className="pt-2 text-xs text-slate-400 hover:text-red-600"
                  />
                </div>
              ))}
          </div>
        </section>
      ))}
      <section className="card p-4">
        <NotesForm
          action={saveRateNotes}
          name="rateCardNotes"
          label="Rate card policies (minimums, travel time, overtime)"
          defaultValue={user.company.rateCardNotes ?? ""}
        />
      </section>
    </div>
  );
}
