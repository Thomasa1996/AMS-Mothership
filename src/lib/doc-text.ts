import "server-only";
import ExcelJS from "exceljs";
import JSZip from "jszip";

// Plain text of a PDF, Word or Excel file, one line per line of the document, for reading a proposal's
// total. Returns "" for anything else or a file that can't be read.
export async function documentText(fileName: string, data: Uint8Array): Promise<string> {
  try {
    if (/\.pdf$/i.test(fileName)) return await pdfText(data);
    if (/\.docx$/i.test(fileName)) return await docxText(data);
    if (/\.xlsx$/i.test(fileName)) return await xlsxText(data);
  } catch {
    // A damaged or locked file just has no total read.
  }
  return "";
}

async function pdfText(data: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Hand pdfjs its worker code directly; on the server it otherwise looks for a worker file the bundle doesn't have.
  const g = globalThis as { pdfjsWorker?: unknown };
  g.pdfjsWorker ??= await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  // pdfjs takes ownership of the buffer it's given, so hand it a copy.
  const doc = await pdfjs.getDocument({ data: data.slice(), isEvalSupported: false, useSystemFonts: false }).promise;
  try {
    let text = "";
    for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      for (const item of content.items) if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
      text += "\n";
    }
    return text;
  } finally {
    await doc.destroy();
  }
}

async function docxText(data: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  return xml
    .replace(/<\/w:p>|<w:br\/>|<\/w:tc>/g, "\n")
    .replace(/<w:tab\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// One line per row, cells separated by spaces. Amounts formatted as currency get a "$", so they read
// like the dollar figures in a PDF; plain numbers (hours, crew counts) don't.
async function xlsxText(data: Uint8Array): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);
  const lines: string[] = [];
  wb.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell((cell) => {
        const v = cell.value as unknown;
        const o = (v && typeof v === "object" ? v : {}) as { result?: unknown; text?: unknown; richText?: { text: string }[] };
        const value = o.result !== undefined ? o.result : o.richText ? o.richText.map((t) => t.text).join("") : o.text !== undefined ? o.text : v;
        if (typeof value === "number") cells.push(/[$]|currency|accounting/i.test(cell.numFmt ?? "") ? `$${value.toFixed(2)}` : String(value));
        else if (value !== null && value !== undefined && typeof value !== "object") cells.push(String(value));
      });
      if (cells.length) lines.push(cells.join(" "));
    });
  });
  return lines.join("\n");
}

// Sane creation dates only: after 1990 and not in the future (a wrong computer clock happens).
function plausible(d: Date | null): Date | null {
  return d && !isNaN(d.getTime()) && d.getUTCFullYear() >= 1990 && d.getTime() <= Date.now() + 86_400_000 ? d : null;
}

// "D:20260912103000-04'00'" (PDF date) -> Date.
export function parsePdfDate(raw: string): Date | null {
  const m = /^(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(Z|[+-]\d{2}'?\d{2}'?)?/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo = "01", d = "01", h = "00", mi = "00", s = "00", tz] = m;
  const zone = !tz || tz === "Z" ? "Z" : `${tz.slice(0, 3)}:${tz.slice(3).replace(/'/g, "").padEnd(2, "0")}`;
  return plausible(new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${zone}`));
}

// When a PDF or Office file says it was made, from its own properties. Null when it doesn't say.
export async function documentDate(fileName: string, data: Uint8Array): Promise<Date | null> {
  try {
    if (/\.pdf$/i.test(fileName)) {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const g = globalThis as { pdfjsWorker?: unknown };
      g.pdfjsWorker ??= await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      const doc = await pdfjs.getDocument({ data: data.slice(), isEvalSupported: false, useSystemFonts: false }).promise;
      try {
        const { info } = (await doc.getMetadata()) as { info?: { CreationDate?: string; ModDate?: string } };
        return (info?.CreationDate && parsePdfDate(info.CreationDate)) || (info?.ModDate && parsePdfDate(info.ModDate)) || null;
      } finally {
        await doc.destroy();
      }
    }
    if (/\.(docx|xlsx|pptx|dotx)$/i.test(fileName)) {
      const zip = await JSZip.loadAsync(data);
      const core = (await zip.file("docProps/core.xml")?.async("string")) ?? "";
      const created = /<dcterms:created[^>]*>([^<]+)</.exec(core)?.[1] ?? /<dcterms:modified[^>]*>([^<]+)</.exec(core)?.[1];
      return created ? plausible(new Date(created.trim())) : null;
    }
  } catch {
    // No readable date; the caller falls back.
  }
  return null;
}
