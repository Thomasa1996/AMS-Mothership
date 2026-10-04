import { SubNav } from "@/components/main-nav";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SubNav
        items={[
          { href: "/crm/accounts", label: "Accounts" },
          { href: "/crm/contacts", label: "Contacts" },
          { href: "/crm/projects", label: "Projects" },
          { href: "/crm/pipeline", label: "Pipeline" },
        ]}
      />
      {children}
    </div>
  );
}
