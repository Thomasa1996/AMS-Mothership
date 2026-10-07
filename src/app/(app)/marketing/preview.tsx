"use client";

import { useEffect, useRef, useState } from "react";
import { drawPreview, drawnKind } from "@/lib/browser-preview";
import { setMarketingThumbnail } from "./actions";

// The picture at the top of a Marketing card. Saved previews load as images; a PDF or video added
// before previews existed is drawn here when the card scrolls into view (and saved, for an admin).
export function MarketingPreview({ id, fileName, kind, saved, admin }: { id: string; fileName: string; kind: string; saved: boolean; admin: boolean }) {
  const drawable = !!drawnKind(fileName);
  const [src, setSrc] = useState<string | null>(saved || !drawable ? `/marketing-file/${id}/thumb` : null);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const made = useRef<string | null>(null);

  // The drawn picture lives as long as the card.
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
        const file = await (await fetch(`/marketing-file/${id}`)).blob();
        const preview = await drawPreview(fileName, file);
        if (cancelled) return;
        if (!preview) return setFailed(true);
        made.current = URL.createObjectURL(preview);
        setSrc(made.current);
        if (admin) {
          const form = new FormData();
          form.set("thumbnail", preview, "preview.jpg");
          setMarketingThumbnail(id, form).catch(() => {});
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
  }, [id, fileName, drawable, admin, src]);

  return (
    <div ref={box} className="flex h-36 items-center justify-center overflow-hidden bg-slate-50">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover object-top" onError={() => setFailed(true)} />
      ) : (
        <span className="rounded bg-slate-100 px-2 py-1 text-sm font-medium text-slate-600">{!failed && drawable ? "Loading preview..." : kind}</span>
      )}
    </div>
  );
}
