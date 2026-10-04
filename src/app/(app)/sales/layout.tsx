import { SubNav } from "@/components/main-nav";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SubNav
        items={[
          { href: "/sales/quotes", label: "Quotes" },
          { href: "/sales/vendors", label: "Vendors" },
        ]}
      />
      {children}
    </div>
  );
}
