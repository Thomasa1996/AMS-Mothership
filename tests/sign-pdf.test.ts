import { describe, expect, it } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import { SignError, signPdf } from "@/lib/sign-pdf";
import { blockLayout, pdfSafeText } from "@/lib/sign-layout";

// A 2x1 transparent PNG.
const PNG = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"),
);

async function blankPdf(rotation = 0, pages = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([612, 792]).setRotation(degrees(rotation));
  return doc.save();
}

// Where pdfjs (what the browser preview uses) shows each piece of text, as shares of the page shown.
async function shownText(pdf: Uint8Array, pageNum = 1) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const g = globalThis as { pdfjsWorker?: unknown };
  g.pdfjsWorker ??= await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const doc = await pdfjs.getDocument({ data: pdf.slice(), isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise;
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const out: Record<string, { left: number; baseline: number }> = {};
  for (const item of content.items) {
    if (!("str" in item) || !item.str) continue;
    const [x, y] = pdfjs.Util.applyTransform([item.transform[4], item.transform[5]], viewport.transform);
    out[item.str] = { left: x / viewport.width, baseline: y / viewport.height };
  }
  await doc.destroy();
  return { text: out, width: viewport.width, height: viewport.height };
}

const lines = { name: "Thomas Anderson", title: "Commercial Sales", company: "Apple Moving", date: "October 25, 2026" };

describe("signPdf", () => {
  for (const rotation of [0, 90, 180, 270]) {
    it(`puts the block where it was placed on a page rotated ${rotation}°`, async () => {
      const signed = await signPdf(await blankPdf(rotation), PNG, { page: 1, left: 0.1, top: 0.6, width: 0.4 }, lines);
      const { text, width, height } = await shownText(signed);
      const layout = blockLayout(0.4 * width, 2, lines);
      const company = layout.items.find((i) => i.kind === "text" && i.text === "Apple Moving");
      expect(company?.kind).toBe("text");
      expect(text["Apple Moving"].left).toBeCloseTo(0.1, 2);
      expect(text["Apple Moving"].baseline).toBeCloseTo(0.6 + (company!.kind === "text" ? company!.baseline : 0) / height, 2);
      expect(Object.keys(text)).toEqual(["Thomas Anderson", "Commercial Sales", "Apple Moving", "October 25, 2026"]);
    });
  }

  it("signs the page asked for and leaves out blank lines", async () => {
    const signed = await signPdf(await blankPdf(0, 3), PNG, { page: 2, left: 0.5, top: 0.5, width: 0.3 }, { ...lines, title: " " });
    expect(Object.keys((await shownText(signed, 1)).text)).toEqual([]);
    expect(Object.keys((await shownText(signed, 2)).text)).toEqual(["Thomas Anderson", "Apple Moving", "October 25, 2026"]);
    expect((await PDFDocument.load(signed)).getPageCount()).toBe(3);
  });

  it("refuses a page that isn't there and a file that isn't a PDF", async () => {
    await expect(signPdf(await blankPdf(), PNG, { page: 4, left: 0, top: 0, width: 0.3 }, lines)).rejects.toBeInstanceOf(SignError);
    await expect(signPdf(new TextEncoder().encode("%PDF-junk"), PNG, { page: 1, left: 0, top: 0, width: 0.3 }, lines)).rejects.toBeInstanceOf(SignError);
  });
});

describe("pdfSafeText", () => {
  it("keeps Latin-1 and plain quotes, drops what the PDF font can't draw", () => {
    expect(pdfSafeText("José’s “Moving” – Co ✍️")).toBe("José's \"Moving\" - Co ");
  });
});
