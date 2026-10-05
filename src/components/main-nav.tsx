"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/crm", label: "CRM" },
  { href: "/operations", label: "Operations" },
  { href: "/sales", label: "Sales" },
  { href: "/training", label: "Training" },
  { href: "/reports", label: "Revenue", adminOnly: true },
];

export function MainNav({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
      {TABS.filter((tab) => admin || !("adminOnly" in tab)).map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

// exact: only highlight on that page itself, for a tab whose address is the start of its siblings'.
export function SubNav({ items }: { items: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-4 overflow-x-auto border-b border-slate-200 print:hidden">
      {items.map((item) => {
        const active = pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
              active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
