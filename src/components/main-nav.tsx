"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/crm", label: "CRM" },
  { href: "/operations", label: "Operations" },
  { href: "/sales", label: "Sales" },
  { href: "/warehouse", label: "Warehouse" },
  { href: "/reports", label: "Reports" },
];

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
      {TABS.map((tab) => {
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

export function SubNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-4 overflow-x-auto border-b border-slate-200">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
