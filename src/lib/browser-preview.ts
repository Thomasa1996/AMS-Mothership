"use client";

// Draws a card preview in the browser for files the server can't picture: a PDF's first page or a
// frame of a video. Returns a JPEG, or null if the file can't be drawn.

const WIDTH = 480;

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8));
}

async function pdfPreview(file: Blob): Promise<Blob | null> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return await canvasToJpeg(canvas);
  } finally {
    await doc.destroy();
  }
}

function videoPreview(file: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (b: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve(b);
    };
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onerror = () => done(null);
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    };
    video.onseeked = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = Math.round((WIDTH * video.videoHeight) / (video.videoWidth || WIDTH)) || Math.round(WIDTH * 0.5625);
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      done(await canvasToJpeg(canvas));
    };
    setTimeout(() => done(null), 15000);
    video.src = url;
  });
}

export type DrawnKind = "pdf" | "video";

export function drawnKind(fileName: string): DrawnKind | null {
  if (/\.pdf$/i.test(fileName)) return "pdf";
  if (/\.(mp4|mov)$/i.test(fileName)) return "video";
  return null;
}

export async function drawPreview(fileName: string, file: Blob): Promise<Blob | null> {
  try {
    const kind = drawnKind(fileName);
    if (kind === "pdf") return await pdfPreview(file);
    if (kind === "video") return await videoPreview(file);
  } catch {
    // An unreadable or protected file just goes without a preview.
  }
  return null;
}
