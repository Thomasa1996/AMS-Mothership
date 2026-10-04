import Link from "next/link";
import { branchPhotoUrl } from "@/lib/photos";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { factValues } from "@/lib/branch-import";
import { branchDetails, contactWithTitle, factorLabel } from "@/lib/branches";
import { EmptyState, PageHeader } from "@/components/ui";

// Adds up square footage across a branch's warehouses ("40,000 sqft" + "30,000 sqft").
function totalSquareFeet(values: string[]) {
  const nums = values.map((v) => Number(v.replace(/[^0-9.]/g, ""))).filter((n) => n > 0);
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
}

export default async function WarehousesPage() {
  const user = await requireUser();
  const branches = await db.branch.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title="Warehouses"
        subtitle={`${branches.length} branches · warehouse profiles and market rates`}
        actions={user.role === "ADMIN" ? <Link href="/sales/warehouses/import" className="btn">Import profiles</Link> : undefined}
      />
      <div className="card overflow-x-auto">
        {branches.length === 0 ? (
          <EmptyState>
            No branches yet.{" "}
            {user.role === "ADMIN" && <Link href="/sales/warehouses/import" className="link">Import your branch profile workbook</Link>}
          </EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Branch</th>
                <th>General manager</th>
                <th className="text-right">Warehouse sq. ft.</th>
                <th className="text-right">Crews</th>
                <th>Grade</th>
                <th>Labor rates</th>
                <th>Storage rates</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => {
                const d = branchDetails(b);
                const gm = contactWithTitle(d.contacts, "General Manager");
                const sqft = totalSquareFeet(factValues(d.profile, "Total Square Feet"));
                const crews = factValues(d.profile, "# of Crews").find(Boolean);
                return (
                  <tr key={b.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {branchPhotoUrl(b) ? (
                          <span className="h-10 w-14 shrink-0 rounded bg-cover bg-center" style={{ backgroundImage: `url(${branchPhotoUrl(b)})` }} />
                        ) : (
                          <span className="h-10 w-14 shrink-0 rounded bg-slate-100" />
                        )}
                        <div>
                          <Link href={`/sales/warehouses/${b.id}`} className="link font-medium">{b.name}</Link>
                          <div className="text-xs text-slate-500">
                            {d.warehouses.length > 1 ? `${d.warehouses.length} warehouses` : d.warehouses[0]?.cityStateZip ?? d.warehouses[0]?.address ?? "No address on file"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{gm?.name ?? <span className="text-slate-400">None listed</span>}</td>
                    <td className="text-right tabular-nums">{sqft ? sqft.toLocaleString() : <span className="text-slate-400">None</span>}</td>
                    <td className="text-right tabular-nums">{crews ?? <span className="text-slate-400">None</span>}</td>
                    <td>{b.warehouseGrade ?? <span className="text-slate-400">Not graded</span>}</td>
                    <td className="whitespace-nowrap">{factorLabel(b.laborFactor)}</td>
                    <td className="whitespace-nowrap">{factorLabel(b.storageFactor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Coming next on this tab: inventory per account with locations, barcode labels, a move-in and move-out log, and monthly storage billing.
      </p>
    </div>
  );
}
