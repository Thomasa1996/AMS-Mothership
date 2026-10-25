import { PDFDocument, StandardFonts, degrees, rgb, type PDFPage } from "pdf-lib";
import { MAX_BLOCK_WIDTH, MIN_BLOCK_WIDTH, blockLayout, pdfSafeText, type SignLines } from "./sign-layout";

// Stamps a signature block onto one page of a PDF (Sales > Sign documents). The spot comes from the
// page as the browser showed it: left, top and width are shares of that page's width and height, top
// measured down from the top edge. Rotated pages are handled so the block lands upright where it was placed.

export type Placement = { page: number; left: number; top: number; width: number };

export class SignError extends Error {}

// Turns a point on the page as shown (u right, v down, in points) into the page's own coordinates.
function pageMapper(page: PDFPage) {
  const box = page.getCropBox();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const sideways = rotation === 90 || rotation === 270;
  const shown = { width: sideways ? box.height : box.width, height: sideways ? box.width : box.height };
  const map = (u: number, v: number) => {
    if (rotation === 90) return { x: box.x + v, y: box.y + u };
    if (rotation === 180) return { x: box.x + box.width - u, y: box.y + v };
    if (rotation === 270) return { x: box.x + box.width - v, y: box.y + box.height - u };
    return { x: box.x + u, y: box.y + box.height - v };
  };
  return { shown, map, rotate: degrees(rotation) };
}

export async function signPdf(pdf: Uint8Array, signaturePng: Uint8Array, placement: Placement, lines: SignLines): Promise<Uint8Array> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdf);
  } catch (e) {
    if (e instanceof Error && /encrypt/i.test(e.message)) throw new SignError("That PDF is password protected. Save an unlocked copy and try again.");
    throw new SignError("That PDF couldn't be opened. Try saving it again as a PDF.");
  }
  const pages = doc.getPages();
  const page = pages[placement.page - 1];
  if (!page) throw new SignError("That page isn't in the PDF");

  const { shown, map, rotate } = pageMapper(page);
  const width = Math.min(Math.max(placement.width, MIN_BLOCK_WIDTH), MAX_BLOCK_WIDTH) * shown.width;
  const originU = Math.min(Math.max(placement.left, 0), 1) * shown.width;
  const originV = Math.min(Math.max(placement.top, 0), 1) * shown.height;

  const image = await doc.embedPng(signaturePng);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.07, 0.09, 0.15);

  const safe: SignLines = {
    name: pdfSafeText(lines.name),
    title: pdfSafeText(lines.title),
    company: pdfSafeText(lines.company),
    date: pdfSafeText(lines.date),
  };
  for (const item of blockLayout(width, image.width / image.height, safe).items) {
    if (item.kind === "image") {
      // pdf-lib places a picture by its bottom-left corner.
      const at = map(originU + item.left, originV + item.top + item.height);
      page.drawImage(image, { ...at, width: item.width, height: item.height, rotate });
    } else if (item.kind === "rule") {
      const v = originV + item.top;
      page.drawLine({ start: map(originU + item.left, v), end: map(originU + item.left + item.width, v), thickness: item.thickness, color: ink });
    } else {
      const at = map(originU + item.left, originV + item.baseline);
      page.drawText(item.text, { ...at, size: item.size, font: item.bold ? bold : regular, color: ink, rotate });
    }
  }
  return doc.save();
}
