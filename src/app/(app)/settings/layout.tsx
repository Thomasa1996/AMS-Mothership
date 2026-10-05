import { SubNav } from "@/components/main-nav";
import { requireUser } from "@/lib/auth";

// Only admins see Team, Rate card, Quote template and HubSpot; each page also redirects anyone else.
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const admin = user.role === "ADMIN";
  return (
    <div className="space-y-6">
      <SubNav
        items={[
          { href: "/settings/profile", label: "My profile" },
          ...(admin
            ? [
                { href: "/settings/users", label: "Team" },
                { href: "/settings/rates", label: "Rate card" },
                { href: "/settings/quote-template", label: "Quote template" },
                { href: "/settings/hubspot", label: "HubSpot" },
                { href: "/settings/smartsheet", label: "Smartsheet" },
                { href: "/settings/apollo", label: "Apollo" },
                { href: "/settings/powerbi", label: "Power BI" },
              ]
            : []),
        ]}
      />
      {children}
    </div>
  );
}
