"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveUserPhoto } from "@/app/(app)/settings/actions";
import { Avatar } from "./ui";

// Center-crops the chosen picture to a square and shrinks it to 256px, so a phone photo of any
// size uploads as a small JPEG.
async function squareJpeg(file: File, size = 256) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function PhotoUpload({
  userId,
  name,
  photoUrl,
  size = "md",
}: {
  userId: string;
  name: string;
  photoUrl: string | null;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (photo: string | null) =>
    start(async () => {
      const res = await saveUserPhoto(userId, photo);
      setError(res.error ?? null);
      router.refresh();
    });
  return (
    <div>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <Avatar name={name} photoUrl={photoUrl} size={size} />
        <label
          className={`cursor-pointer text-sm text-brand-700 hover:underline ${pending ? "opacity-50" : ""}`}
        >
          {pending ? "Saving..." : photoUrl ? "Change photo" : "Add photo"}
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
                save(await squareJpeg(file));
              } catch {
                setError("That file couldn't be read as a picture");
              }
            }}
          />
        </label>
        {photoUrl && !pending && (
          <button
            type="button"
            className="text-sm text-slate-500 hover:text-red-600"
            onClick={() => save(null)}
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
