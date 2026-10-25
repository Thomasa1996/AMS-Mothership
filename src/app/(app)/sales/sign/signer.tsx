"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { MAX_BLOCK_WIDTH, MIN_BLOCK_WIDTH, blockLayout, type SignLines } from "@/lib/sign-layout";
import { signDocument } from "./actions";

const MAX_PDF_BYTES = 4 * 1024 * 1024;

type Spot = { left: number; top: number; width: number };

// The signature as a PNG (the PDF stamp takes PNGs), whatever picture type it was saved as.
async function signaturePng(src: string): Promise<{ blob: Blob; aspect: number }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const w = img.naturalWidth || 900;
  const h = img.naturalHeight || 300;
  const scale = Math.min(1, 1200 / w);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Couldn't draw the signature");
  return { blob, aspect: w / h };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi));

// Pick a PDF, flip to the page, drag the signature block where it goes (and size it from its corner),
// check the name, title, company and date, then sign. The signed copy downloads and is listed below.
export function DocumentSigner({ signature, defaults }: { signature: string | null; defaults: SignLines }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageAspect, setPageAspect] = useState(8.5 / 11);
  const [boxWidth, setBoxWidth] = useState(0);
  const [spot, setSpot] = useState<Spot>({ left: 0.08, top: 0.75, width: 0.3 });
  const [lines, setLines] = useState<SignLines>(defaults);
  const [sigAspect, setSigAspect] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; name: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ mode: "move" | "size"; dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (!signature) return;
    const img = new Image();
    img.onload = () => img.naturalWidth && img.naturalHeight && setSigAspect(img.naturalWidth / img.naturalHeight);
    img.src = signature;
  }, [signature]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const watch = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    watch.observe(el);
    return () => watch.disconnect();
  }, [pdf]);

  useEffect(() => () => void pdf?.destroy(), [pdf]);

  // Draw the current page to fit the box.
  useEffect(() => {
    if (!pdf || !boxWidth || !canvas.current) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setPageAspect(base.width / base.height);
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: (boxWidth * ratio) / base.width });
      const c = canvas.current!;
      c.width = Math.round(viewport.width);
      c.height = Math.round(viewport.height);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      task = page.render({ canvasContext: ctx, viewport });
      await task.promise.catch(() => {});
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNum, boxWidth]);

  async function pick(files: FileList | null) {
    const f = files?.[0];
    setError(null);
    setDone(null);
    if (!f) return;
    if (f.size > MAX_PDF_BYTES) return setError("That PDF is over 4 MB. Try saving it smaller (in Word: File, Save As, PDF, Minimum size).");
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
      setFile(f);
      setPdf(doc);
      // Signatures usually go at the end.
      setPageNum(doc.numPages);
    } catch (e) {
      setError(e instanceof Error && e.name === "PasswordException" ? "That PDF is password protected. Save an unlocked copy and try again." : "That file couldn't be opened as a PDF.");
    }
  }

  const pageHeight = boxWidth / pageAspect;
  const blockPx = spot.width * boxWidth;
  const layout = blockLayout(blockPx, sigAspect, lines);
  const heightShare = pageHeight ? layout.height / pageHeight : 0;

  function onPointerDown(e: React.PointerEvent, mode: "move" | "size") {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const r = box.current!.getBoundingClientRect();
    drag.current = { mode, dx: (e.clientX - r.left) / r.width - spot.left, dy: (e.clientY - r.top) / r.height - spot.top };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const r = box.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (d.mode === "move") {
      setSpot((s) => ({ ...s, left: clamp(x - d.dx, 0, 1 - s.width), top: clamp(y - d.dy, 0, 1 - heightShare) }));
    } else {
      setSpot((s) => ({ ...s, width: clamp(x - s.left, MIN_BLOCK_WIDTH, Math.min(MAX_BLOCK_WIDTH, 1 - s.left)) }));
    }
  }

  // Clicking the page moves the block there.
  function onPageClick(e: React.MouseEvent) {
    const r = box.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setSpot((s) => ({ ...s, left: clamp(x - s.width / 2, 0, 1 - s.width), top: clamp(y - heightShare / 2, 0, 1 - heightShare) }));
  }

  async function sign() {
    if (!file || !signature) return;
    setBusy(true);
    setError(null);
    try {
      const png = await signaturePng(signature);
      const form = new FormData();
      form.set("file", file);
      form.set("signature", png.blob, "signature.png");
      form.set("page", String(pageNum));
      form.set("left", String(spot.left));
      form.set("top", String(spot.top));
      form.set("width", String(spot.width));
      for (const [k, v] of Object.entries(lines)) form.set(k, v);
      const res = await signDocument(form);
      if ("error" in res) return setError(res.error);
      setDone({ id: res.id, name: file.name });
      setFile(null);
      setPdf(null);
      window.location.assign(`/signed-doc/${res.id}`);
      router.refresh();
    } catch {
      setError("That document couldn't be signed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof SignLines, label: string, placeholder?: string) => (
    <div>
      <label className="label" htmlFor={`sign-${key}`}>{label}</label>
      <input className="input" id={`sign-${key}`} value={lines[key]} placeholder={placeholder} onChange={(e) => setLines((l) => ({ ...l, [key]: e.target.value }))} />
    </div>
  );

  if (!signature) {
    return <p className="text-sm text-slate-500">Save your signature above first, then pick the PDF to sign here.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn btn-primary cursor-pointer">
          {pdf ? "Pick a different PDF" : "Choose a PDF"}
          <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        </label>
        {file && <span className="truncate text-sm text-slate-600">{file.name}</span>}
      </div>
      {done && (
        <p className="text-sm text-emerald-600">
          Signed {done.name}. It&apos;s downloading and saved below. <a className="link" href={`/signed-doc/${done.id}`}>Download again</a>
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {pdf && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">Drag the signature where it goes. Drag its corner to resize.</span>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" className="btn py-1" disabled={pageNum <= 1} onClick={() => setPageNum((n) => n - 1)} aria-label="Previous page">‹</button>
                <span>Page {pageNum} of {pdf.numPages}</span>
                <button type="button" className="btn py-1" disabled={pageNum >= pdf.numPages} onClick={() => setPageNum((n) => n + 1)} aria-label="Next page">›</button>
              </div>
            </div>
            <div
              ref={box}
              className="relative w-full select-none overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
              style={{ aspectRatio: String(pageAspect) }}
              onClick={onPageClick}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            >
              <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
              {boxWidth > 0 && (
                <div
                  className="absolute cursor-move touch-none outline outline-2 outline-offset-4 outline-brand-500/70"
                  style={{ left: spot.left * boxWidth, top: spot.top * pageHeight, width: blockPx, height: layout.height, color: "#111827" }}
                  onPointerDown={(e) => onPointerDown(e, "move")}
                  onClick={(e) => e.stopPropagation()}
                >
                  {layout.items.map((item, i) =>
                    item.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={signature} alt="" draggable={false} className="absolute" style={{ left: item.left, top: item.top, width: item.width, height: item.height }} />
                    ) : item.kind === "rule" ? (
                      <div key={i} className="absolute bg-current" style={{ left: item.left, top: item.top - item.thickness / 2, width: item.width, height: item.thickness }} />
                    ) : (
                      <div
                        key={i}
                        className="absolute whitespace-nowrap"
                        style={{ left: item.left, top: item.baseline - item.size * 0.9, fontSize: item.size, lineHeight: 1, fontFamily: "Helvetica, Arial, sans-serif", fontWeight: item.bold ? 700 : 400 }}
                      >
                        {item.text}
                      </div>
                    ),
                  )}
                  <div
                    className="absolute -bottom-3 -right-3 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-brand-600 shadow"
                    onPointerDown={(e) => onPointerDown(e, "size")}
                    aria-label="Resize signature"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {field("name", "Name")}
            {field("title", "Title", "e.g. Commercial Sales Manager")}
            {field("company", "Company")}
            {field("date", "Date")}
            <p className="text-xs text-slate-500">Clear a line to leave it off.</p>
            <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={sign}>
              {busy ? "Signing..." : "Sign and download"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
