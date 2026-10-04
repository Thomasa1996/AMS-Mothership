"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBackground } from "@/app/(app)/settings/actions";

// Shrinks the picture to at most 1920px wide so a large photo uploads as a few hundred KB.
async function shrinkJpeg(file: File, maxWidth = 1920) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function BackgroundUpload({ current }: { current: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (image: string | null) =>
    start(async () => {
      const res = await saveBackground(image);
      setError(res.error ?? null);
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="h-14 w-24 shrink-0 rounded border border-slate-200 bg-slate-50 bg-cover bg-center"
          style={current ? { backgroundImage: `url(${current})` } : undefined}
        />
        <label className={`btn cursor-pointer ${pending ? "opacity-50" : ""}`}>
          {pending ? "Saving..." : current ? "Change picture" : "Upload picture"}
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
                save(await shrinkJpeg(file));
              } catch {
                setError("That file couldn't be read as a picture");
              }
            }}
          />
        </label>
        {current && !pending && (
          <button type="button" className="text-sm text-slate-500 hover:text-red-600" onClick={() => save(null)}>
            Remove
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">Shows behind every page, dimmed so text stays readable. Only you see it.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
