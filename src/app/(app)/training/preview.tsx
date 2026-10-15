"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { drawPreview } from "@/lib/browser-preview";
import { setTrainingPicture, setTrainingThumbnail } from "./actions";

// The picture at the top of a Training card: its saved picture, a YouTube video's still, or for a PDF
// without one, its first page drawn here when the card scrolls into view (and saved, for an admin).
// Admins can also pick their own picture for it.
export function TrainingPreview({ id, fileName, label, saved, admin }: { id: string; fileName: string | null; label: string; saved: boolean; admin: boolean }) {
  const router = useRouter();
  const drawable = !!fileName;
  const [version, setVersion] = useState(0);
  const [src, setSrc] = useState<string | null>(saved || !drawable ? `/training-file/${id}/thumb` : null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const made = useRef<string | null>(null);

  useEffect(() => () => {
    if (made.current) URL.revokeObjectURL(made.current);
  }, []);

  // A picture that failed to load before this mounted never fires onError, so check it once here.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src, version]);

  useEffect(() => {
    if (src || !fileName || !box.current) return;
    let cancelled = false;
    const watcher = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      watcher.disconnect();
      try {
        const file = await (await fetch(`/training-file/${id}`)).blob();
        const preview = await drawPreview(fileName, file);
        if (cancelled) return;
        if (!preview) return setFailed(true);
        made.current = URL.createObjectURL(preview);
        setSrc(made.current);
        if (admin) {
          const form = new FormData();
          form.set("thumbnail", preview, "preview.jpg");
          setTrainingThumbnail(id, form).catch(() => {});
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, { rootMargin: "200px" });
    watcher.observe(box.current);
    return () => {
      cancelled = true;
      watcher.disconnect();
    };
  }, [id, fileName, admin, src]);

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("picture", f);
    try {
      const res = await setTrainingPicture(id, form);
      if (res.error) setError(res.error);
      else {
        setFailed(false);
        setVersion((v) => v + 1);
        setSrc(`/training-file/${id}/thumb`);
        router.refresh();
      }
    } catch {
      setError("That picture couldn't be saved. Try again.");
    }
    setBusy(false);
    if (picker.current) picker.current.value = "";
  }

  return (
    <div ref={box} className="group relative flex h-36 items-center justify-center overflow-hidden bg-slate-50">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={img} src={version ? `${src}?v=${version}` : src} alt="" loading="lazy" className="h-full w-full object-cover object-top" onError={() => setFailed(true)} />
      ) : (
        <span className="rounded bg-slate-100 px-2 py-1 text-sm font-medium text-slate-600">{!failed && drawable ? "Loading preview..." : label}</span>
      )}
      {admin && (
        <>
          <button
            type="button"
            className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white shadow-sm hover:bg-black/75"
            disabled={busy}
            onClick={() => picker.current?.click()}
          >
            {busy ? "Saving..." : "Change picture"}
          </button>
          <input ref={picker} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => pick(e.target.files)} />
          {error && <p className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs text-red-300">{error}</p>}
        </>
      )}
    </div>
  );
}
