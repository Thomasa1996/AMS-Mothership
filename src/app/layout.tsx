import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mothership",
  description: "Relocation Shephard Software: CRM, operations and sales for commercial movers",
};

// Dark is the default, including the sign-in page; each person can switch in My profile.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={user?.theme === "light" ? "" : "dark"}>
      <body>{children}</body>
    </html>
  );
}
