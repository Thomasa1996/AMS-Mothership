import type { Metadata, Viewport } from "next";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mothership",
  description: "Mothership: AMS Commercial Moving. CRM, operations and sales for commercial moves",
  appleWebApp: { capable: true, title: "Mothership", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0f1b3d" };

// Dark is the default, including the sign-in page; each person can switch in My profile.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={user?.theme === "light" ? "" : "dark"}>
      <body>{children}</body>
    </html>
  );
}
