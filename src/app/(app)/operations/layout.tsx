import { SubNav } from "@/components/main-nav";

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SubNav
        items={[
          { href: "/operations", label: "Overview", exact: true },
          { href: "/operations/remote-control", label: "Remote control" },
        ]}
      />
      {children}
    </div>
  );
}
