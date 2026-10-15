"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { drawPreview, drawnKind } from "@/lib/browser-preview";
import { saveDrawnQuoteThumbnail, setQuoteDocPicture } from "./doc-actions";

// The small preview beside a quote file: its saved picture, or for a PDF without one, its first page
// drawn here when the row scrolls into view (and saved, for its rep or an admin). Those people can
// also pick their own picture for it.
export function QuoteDocPreview({ id, fileName, kind, saved, canEdit }: { id: string; fileName: string; kind: string; saved: boolean; canEdit: boolean }) {
  const router = useRouter();
  const drawable = drawnKind(fileName) === "pdf";
  const [version, setVersion] = useState(0);
  const [src, setSrc] = useState<string | null>(saved || !drawable ? `/quote-doc/${id}/thumb` : null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const made = useRef<string | null>(null);
  const img = useRef<HTMLImageElement>(null);

  // A picture that failed to load before this mounted never fires onError, so check it once here.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src, version]);

  useEffect(() => () => {
    if (made.current) URL.revokeObjectURL(made.current);
  }, []);

  useEffect(() => {
    if (src || !drawable || !box.current) return;
    let cancelled = false;
    const watcher = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      watcher.disconnect();
      try {
        const file = await (await fetch(`/quote-doc/${id}`)).blob();
        const preview = await drawPreview(fileName, file);
        if (cancelled) return;
        if (!preview) return setFailed(true);
        made.current = URL.createObjectURL(preview);
        setSrc(made.current);
        if (canEdit) {
          const form = new FormData();
          form.set("thumbnail", preview, "preview.jpg");
          saveDrawnQuoteThumbnail(id, form).catch(() => {});
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
  }, [id, fileName, drawable, canEdit, src]);

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("picture", f);
    try {
      const res = await setQuoteDocPicture(id, form);
      if (res.error) setError(res.error);
      else {
        setFailed(false);
        setVersion((v) => v + 1);
        setSrc(`/quote-doc/${id}/thumb`);
        router.refresh();
      }
    } catch {
      setError("That picture couldn't be saved. Try again.");
    }
    setBusy(false);
    if (picker.current) picker.current.value = "";
  }

  return (
    <div className="w-16 shrink-0">
      <a href={`/quote-doc/${id}`} target="_blank" rel="noreferrer" className="block">
        <div ref={box} className="flex h-20 w-16 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
          {src && !failed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img ref={img} src={version ? `${src}?v=${version}` : src} alt="" loading="lazy" className="h-full w-full object-cover object-top" onError={() => setFailed(true)} />
          ) : (
            <span className="px-1 text-center text-[10px] font-medium text-slate-500">{!failed && drawable ? "..." : kind}</span>
          )}
        </div>
      </a>
      {canEdit && (
        <>
          <button type="button" className="mt-1 w-full text-center text-[11px] text-slate-500 hover:text-slate-800" disabled={busy} onClick={() => picker.current?.click()}>
            {busy ? "Saving..." : "Change picture"}
          </button>
          <input ref={picker} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => pick(e.target.files)} />
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
