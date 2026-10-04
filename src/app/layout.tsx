import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mothership",
  description: "Relocation Shephard Software: CRM, operations and sales for commercial movers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
