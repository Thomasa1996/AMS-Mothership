"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NewBusinessTabs({ lists }: { lists: number }) {
  const path = usePathname();
  const onLists = path.startsWith("/sales/new-business/lists");
  const cls = (active: boolean) => `rounded-md px-3 py-1.5 text-sm ${active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`;
  return (
    <div className="flex gap-1 rounded-lg border border-slate-200 p-1">
      <Link href="/sales/new-business" className={cls(!onLists)}>Search</Link>
      <Link href="/sales/new-business/lists" className={cls(onLists)}>Lists{lists ? ` (${lists})` : ""}</Link>
    </div>
  );
}
