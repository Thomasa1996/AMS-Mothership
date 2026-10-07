import "server-only";
import JSZip from "jszip";
import sharp from "sharp";

// Card previews for the Marketing tab: small JPEGs, 480px wide.
const WIDTH = 480;

// Documents keep their top (the title); pictures are cropped around the middle.
export async function toThumbnail(image: Uint8Array, keepTop = true): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const out = await sharp(Buffer.from(image), { limitInputPixels: 100_000_000 })
      .rotate()
      .resize({ width: WIDTH, height: Math.round(WIDTH * 0.75), fit: "cover", position: keepTop ? "top" : "centre", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 78 })
      .toBuffer();
    return new Uint8Array(out);
  } catch {
    return null;
  }
}

// PowerPoint, Word and Excel files usually carry a picture of their first page or slide.
async function officePreview(data: Uint8Array): Promise<Uint8Array | null> {
  try {
    const zip = await JSZip.loadAsync(data);
    const entry = Object.values(zip.files).find((f) => /^docProps\/thumbnail\.(jpe?g|png)$/i.test(f.name));
    return entry ? await entry.async("uint8array") : null;
  } catch {
    return null;
  }
}

const OFFICE = /\.(pptx|docx|xlsx|dotx)$/i;
export const PICTURE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

// What the server can preview by itself; PDFs and videos are drawn in the browser instead.
export function serverCanPreview(fileName: string, contentType: string) {
  return PICTURE_TYPES.has(contentType) || OFFICE.test(fileName);
}

export async function makeThumbnail(fileName: string, contentType: string, data: Uint8Array) {
  if (PICTURE_TYPES.has(contentType)) return toThumbnail(data, false);
  if (OFFICE.test(fileName)) {
    const picture = await officePreview(data);
    return picture ? toThumbnail(picture) : null;
  }
  return null;
}
