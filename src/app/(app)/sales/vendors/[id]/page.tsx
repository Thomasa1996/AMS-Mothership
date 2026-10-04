import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { MISSING_COMPANY } from "@/lib/constants";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { deleteVendor, updateVendor } from "../actions";
import { VendorForm } from "../forms";
import { vendorOptions } from "../options";
import { VerificationBadge } from "../status-badge";

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const vendor = await db.vendor.findFirst({ where: { id, companyId: user.companyId } });
  if (!vendor) notFound();
  const [options, others] = await Promise.all([
    vendorOptions(user.companyId),
    vendor.name === MISSING_COMPANY
      ? []
      : db.vendor.findMany({
          where: { companyId: user.companyId, name: vendor.name, category: vendor.category, id: { not: vendor.id } },
          orderBy: { position: "asc" },
        }),
  ]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={vendor.name}
        subtitle={
          <span className="flex items-center gap-2">
            <Link href={`/sales/vendors?category=${encodeURIComponent(vendor.category)}`} className="link">{vendor.category}</Link>
            <VerificationBadge status={vendor.verificationStatus} />
          </span>
        }
      />
      {others.length > 0 && (
        <div className="card mb-6 p-4">
          <h2 className="mb-2 text-sm font-semibold">Other contacts at {vendor.name}</h2>
          <ul className="space-y-1 text-sm">
            {others.map((o) => (
              <li key={o.id}>
                <Link href={`/sales/vendors/${o.id}`} className="link">{o.contactName ?? "No named contact"}</Link>
                {o.phone && <span className="text-slate-500"> · {o.phone}</span>}
                {o.email && <span className="text-slate-500"> · {o.email}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="card p-5">
        <VendorForm action={updateVendor.bind(null, vendor.id)} defaults={vendor} {...options} submitLabel="Save changes" />
      </div>
      <div className="mt-4">
        <ConfirmButton action={deleteVendor.bind(null, vendor.id)} label="Delete vendor" confirmText={`Delete ${vendor.name}?`} />
      </div>
    </div>
  );
}
