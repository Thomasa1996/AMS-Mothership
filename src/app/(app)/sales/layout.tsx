import { SubNav } from "@/components/main-nav";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 print:space-y-0">
      <SubNav
        items={[
          { href: "/sales/quotes", label: "Quotes" },
          { href: "/sales/quote-templates", label: "Quote templates" },
          { href: "/sales/rates", label: "Rate card" },
          { href: "/sales/vendors", label: "Vendors" },
          { href: "/sales/warehouses", label: "Warehouses" },
          { href: "/sales/project-management", label: "Master List Project Management" },
          { href: "/sales/new-business", label: "New Business Development" },
        ]}
      />
      {children}
    </div>
  );
}
