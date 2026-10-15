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
