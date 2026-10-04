import { SubNav } from "@/components/main-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SubNav
        items={[
          { href: "/settings/profile", label: "My profile" },
          { href: "/settings/users", label: "Team" },
          { href: "/settings/rates", label: "Rate card" },
          { href: "/settings/quote-template", label: "Quote template" },
          { href: "/settings/hubspot", label: "HubSpot" },
        ]}
      />
      {children}
    </div>
  );
}
