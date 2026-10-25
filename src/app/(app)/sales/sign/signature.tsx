"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveSignature } from "./actions";

const PAD_W = 900;
const PAD_H = 300;

// The canvas cropped to the ink, with a little room around it, as a PNG data URL. Null when blank.
function trimmedPng(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d")!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 8;
  minX = Math.max(minX - pad, 0);
  minY = Math.max(minY - pad, 0);
  maxX = Math.min(maxX + pad, width - 1);
  maxY = Math.min(maxY + pad, height - 1);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

// Your saved signature, and a pad to draw a new one or a picture to upload instead. It's the same
// signature My profile prints on quotes.
export function SignatureCard({ current }: { current: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "draw">(current ? "view" : "draw");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inked, setInked] = useState(false);
  const pad = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  async function save(dataUrl: string) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await saveSignature(dataUrl);
      if (res.error) return setError(res.error);
      setSaved(true);
      setMode("view");
      router.refresh();
    } catch {
      setError("Your signature couldn't be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * PAD_W, y: ((e.clientY - r.top) / r.height) * PAD_H };
  }

  function stroke(to: { x: number; y: number }) {
    const ctx = pad.current!.getContext("2d")!;
    const from = last.current ?? to;
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x + (from === to ? 0.1 : 0), to.y);
    ctx.stroke();
    last.current = to;
  }

  function clear() {
    pad.current?.getContext("2d")!.clearRect(0, 0, PAD_W, PAD_H);
    setInked(false);
  }

  function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|svg\+xml)$/.test(file.type)) return setError("Choose a PNG, JPG or SVG picture");
    if (file.size > 500 * 1024) return setError("Choose a picture under 500 KB");
    const reader = new FileReader();
    reader.onload = () => save(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      {mode === "view" && current ? (
        <div className="flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt="Your signature" className="h-20 max-w-72 rounded border border-slate-200 bg-white object-contain p-2" />
          <button type="button" className="btn" onClick={() => { setSaved(false); setMode("draw"); }}>Change signature</button>
          {saved && <span className="text-sm text-emerald-600">Saved</span>}
        </div>
      ) : (
        <>
          <canvas
            ref={pad}
            width={PAD_W}
            height={PAD_H}
            className="block w-full max-w-xl touch-none rounded-md border border-dashed border-slate-300 bg-white"
            style={{ aspectRatio: `${PAD_W} / ${PAD_H}`, cursor: "crosshair" }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              last.current = null;
              stroke(point(e));
              setInked(true);
            }}
            onPointerMove={(e) => {
              if (last.current) stroke(point(e));
            }}
            onPointerUp={() => (last.current = null)}
            onPointerCancel={() => (last.current = null)}
          />
          <p className="text-xs text-slate-500">Sign in the box with your mouse, finger or stylus, or upload a picture of your signature.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !inked}
              onClick={() => {
                const png = pad.current && trimmedPng(pad.current);
                if (png) save(png);
              }}
            >
              {busy ? "Saving..." : "Save signature"}
            </button>
            <button type="button" className="btn" onClick={clear} disabled={!inked}>Clear</button>
            <label className="btn cursor-pointer">
              Upload a picture
              <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
            {current && <button type="button" className="text-sm text-slate-500 hover:text-slate-800" onClick={() => setMode("view")}>Cancel</button>}
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
