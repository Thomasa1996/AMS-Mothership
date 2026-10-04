import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { BranchImportForm } from "../forms";

export default async function ImportBranchesPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/warehouse");
  return (
    <div className="max-w-2xl">
      <PageHeader title="Import branch profiles" subtitle="Upload the branch profile workbook. Each branch sheet becomes a warehouse page." />
      <div className="card space-y-4 p-5">
        <BranchImportForm />
        <div className="border-t border-slate-100 pt-4 text-sm text-slate-600">
          <p className="mb-1 font-medium text-slate-800">What the importer does</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Reads every sheet that starts with &ldquo;Apple Moving Warehouse Profile&rdquo;, one per branch.</li>
            <li>Picks up addresses (up to three warehouses), contacts and every overview section.</li>
            <li>A branch already here gets its profile refreshed. Its grade, notes and market rates are kept.</li>
            <li>A new branch gets a market rate card from local wage data, which you can adjust.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
