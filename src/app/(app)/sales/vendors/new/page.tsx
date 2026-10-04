import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { createVendor } from "../actions";
import { VendorForm } from "../forms";
import { vendorOptions } from "../options";

export default async function NewVendorPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const user = await requireUser();
  const { category } = await searchParams;
  const options = await vendorOptions(user.companyId);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add vendor" />
      <div className="card p-5">
        <VendorForm action={createVendor} defaults={{ category }} {...options} submitLabel="Add vendor" />
      </div>
    </div>
  );
}
