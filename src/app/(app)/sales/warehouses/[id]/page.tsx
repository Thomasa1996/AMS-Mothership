import Link from "next/link";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { branchDetails, factorLabel, rateCardFor } from "@/lib/branches";
import { formatCents } from "@/lib/quote-math";
import { PageHeader } from "@/components/ui";
import { deleteBranch, updateBranchCapacity } from "../actions";
import { CapacityForm } from "../forms";

const CAPACITY_ROLES = ["ADMIN", "PROJECT_MANAGER", "WAREHOUSE"];

export default async function BranchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const branch = await db.branch.findFirst({ where: { id, companyId: user.companyId } });
  if (!branch) notFound();
  const { warehouses, contacts, profile } = branchDetails(branch);
  const rates = await rateCardFor(user.companyId, branch.id);
  const changed = rates.filter((r) => r.rateCents !== r.standardCents);
  const columns = Math.max(1, warehouses.length);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/sales/warehouses" className="text-sm text-slate-500 hover:text-slate-700">&larr; Warehouses</Link>
        <PageHeader
          title={branch.name}
          subtitle={[branch.profileDate && `Profile dated ${branch.profileDate}`, branch.approval].filter(Boolean).join(" · ") || "Warehouse profile"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">{warehouses.length > 1 ? "Warehouses" : "Warehouse"}</h2>
          {warehouses.length === 0 ? (
            <p className="text-sm text-slate-400">No address on file.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {warehouses.map((w, i) => (
                <li key={i}>
                  {warehouses.length > 1 && <span className="font-medium">Warehouse {i + 1}: </span>}
                  {[w.address, w.cityStateZip].filter(Boolean).join(", ")}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card overflow-x-auto">
          <h2 className="px-4 pt-4 font-semibold">Contacts</h2>
          <table className="table">
            <tbody>
              {contacts.map((c, i) => (
                <tr key={i}>
                  <td className="text-slate-500">{c.title}</td>
                  <td className="font-medium">{c.name ?? <span className="text-slate-400">Not listed</span>}</td>
                  <td className="whitespace-nowrap">{c.phone}</td>
                  <td>{c.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Capacity</h2>
        <CapacityForm
          action={updateBranchCapacity.bind(null, branch.id)}
          canEdit={CAPACITY_ROLES.includes(user.role)}
          defaults={{
            warehouseSpace: branch.warehouseSpace ?? "",
            scale: branch.scale ?? "",
            warehouseNotes: branch.warehouseNotes ?? "",
            warehouseGrade: branch.warehouseGrade ? String(branch.warehouseGrade) : "",
          }}
        />
      </section>

      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Market rates</h2>
            <p className="text-sm text-slate-500">
              Labor and delivery: {factorLabel(branch.laborFactor).toLowerCase()} · Storage: {factorLabel(branch.storageFactor).toLowerCase()} ·{" "}
              {changed.length} of {rates.length} rates differ from the standard card
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/sales/rates?market=${branch.id}`} className="btn">View full rate card</Link>
            {user.role === "ADMIN" && <Link href={`/sales/warehouses/${branch.id}/rates`} className="btn">Edit market rates</Link>}
          </div>
        </div>
        {branch.marketNotes && <p className="mb-3 whitespace-pre-line text-xs text-slate-500">{branch.marketNotes}</p>}
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Rate</th>
                <th className="text-right">Standard</th>
                <th className="text-right">{branch.name}</th>
              </tr>
            </thead>
            <tbody>
              {changed.slice(0, 12).map((r) => (
                <tr key={r.id}>
                  <td>{r.name} <span className="text-xs text-slate-500">/ {r.unit}</span></td>
                  <td className="text-right tabular-nums text-slate-500">{formatCents(r.standardCents)}</td>
                  <td className="text-right font-medium tabular-nums">{formatCents(r.rateCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {changed.length > 12 && (
            <p className="mt-2 text-sm text-slate-500">
              And {changed.length - 12} more. <Link href={`/sales/rates?market=${branch.id}`} className="link">See them all</Link>
            </p>
          )}
        </div>
      </section>

      <div className="columns-1 gap-6 lg:columns-2">
        {profile.map((s) => (
          <section key={s.title} className="card mb-6 break-inside-avoid overflow-x-auto">
            <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{s.title}</h2>
            <table className="table">
              {columns > 1 && (
                <thead>
                  <tr>
                    <th />
                    {warehouses.map((_, i) => <th key={i} className="text-right">Warehouse {i + 1}</th>)}
                  </tr>
                </thead>
              )}
              <tbody>
                {s.facts.map((f, i) => (
                  <tr key={i}>
                    <td className="text-slate-600">{f.label}</td>
                    {Array.from({ length: Math.max(columns, f.values.length) }, (_, c) => (
                      <td key={c} className="text-right">{f.values[c] || <span className="text-slate-300">None</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      {user.role === "ADMIN" && (
        <div className="pt-2">
          <ConfirmButton
            action={deleteBranch.bind(null, branch.id)}
            label={`Remove ${branch.name}`}
            confirmText={`Remove ${branch.name}? Its profile, market rates and rate sheet PDF are deleted. Quotes already priced from it keep their prices. If you import the profile workbook again, delete this sheet from it first.`}
          />
        </div>
      )}
    </div>
  );
}
