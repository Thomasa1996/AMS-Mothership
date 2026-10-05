import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SubNav } from "@/components/main-nav";
import { PageHeader } from "@/components/ui";

// Revenue is admins only for now.
export default async function RevenueLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/crm/accounts");
  return (
    <div className="space-y-6">
      <PageHeader title="Revenue" subtitle="Only admins can see this tab." />
      <SubNav
        items={[
          { href: "/reports", label: "Power BI reports", exact: true },
          { href: "/reports/reps", label: "Sales reps" },
        ]}
      />
      {children}
    </div>
  );
}
