"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTheme } from "@/app/(app)/settings/actions";

const OPTIONS = [
  { id: "dark", label: "Dark", swatch: "bg-[#1f1f1f] border-[#3b3b3b]", bar: "bg-[#2b2b2b]" },
  { id: "light", label: "Light", swatch: "bg-[#f8fafc] border-[#e2e8f0]", bar: "bg-white" },
] as const;

export function ThemePicker({ current }: { current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-3">
      {OPTIONS.map((o) => {
        const active = current === o.id;
        return (
          <button
            key={o.id}
            type="button"
            disabled={pending}
            aria-pressed={active}
            onClick={() =>
              start(async () => {
                await saveTheme(o.id);
                router.refresh();
              })
            }
            className={`flex w-36 flex-col gap-2 rounded-lg border-2 p-2 text-left text-sm font-medium ${active ? "border-brand-500" : "border-slate-200 hover:border-slate-300"}`}
          >
            <span className={`flex h-14 flex-col gap-1.5 rounded border p-2 ${o.swatch}`}>
              <span className="h-2 w-10 rounded-sm bg-[#0f2550]" />
              <span className={`h-5 rounded-sm ${o.bar}`} />
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
