"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { shrinkJpeg } from "@/components/background-upload";
import { saveBranchPhoto } from "../actions";

// The market's city photo across the top of its page. Admins can add, change or remove it.
export function MarketPhoto({ branchId, name, url, canEdit }: { branchId: string; name: string; url: string | null; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!url && !canEdit) return null;
  const save = (image: string | null) =>
    start(async () => {
      const res = await saveBranchPhoto(branchId, image);
      setError(res.error ?? null);
      router.refresh();
    });
  return (
    <div className="space-y-1">
      <div
        className={`relative flex h-48 items-end overflow-hidden rounded-lg bg-cover bg-center sm:h-64 ${url ? "" : "border border-dashed border-slate-300 bg-slate-100"}`}
        style={url ? { backgroundImage: `url(${url})` } : undefined}
        role={url ? "img" : undefined}
        aria-label={url ? `${name} market photo` : undefined}
      >
        {canEdit && (
          <div className="flex w-full items-center justify-end gap-2 p-3">
            {!url && <span className="mr-auto text-sm text-slate-500">Add a photo of {name} for this market.</span>}
            <label className={`btn cursor-pointer ${pending ? "opacity-50" : ""}`}>
              {pending ? "Saving..." : url ? "Change photo" : "Add photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={pending}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    save(await shrinkJpeg(file, 1600));
                  } catch {
                    setError("That file couldn't be read as a picture");
                  }
                }}
              />
            </label>
            {url && !pending && <button type="button" className="btn" onClick={() => save(null)}>Remove</button>}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
