import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ImportForm } from "../forms";

export default async function ImportVendorsPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/sales/vendors");
  return (
    <div className="max-w-2xl">
      <PageHeader title="Import vendors" subtitle="Upload your vendor workbook. Each sheet becomes a vendor category." />
      <div className="card space-y-4 p-5">
        <ImportForm />
        <div className="border-t border-slate-100 pt-4 text-sm text-slate-600">
          <p className="mb-1 font-medium text-slate-800">What the importer expects</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>One sheet per category (Interstate Movers, Crane Rentals, and so on).</li>
            <li>A header row with a Company or Company Name column. Contact Name, Phone, Email, Address, Website, State, Markets, Member ID, Apollo Verification Status and Notes are picked up when present.</li>
            <li>A row with a blank company is linked to the company above it when the email domain matches; otherwise it is marked &ldquo;Company not listed&rdquo; so you can fix it.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
