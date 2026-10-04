// Shared checks for uploaded PDFs (rate sheets, Word quotes). Vercel caps request bodies at 4.5 MB.
export const MAX_PDF_BYTES = 4 * 1024 * 1024;

export async function readPdf(file: FormDataEntryValue | null): Promise<{ error: string } | { data: Uint8Array<ArrayBuffer>; fileName: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF to upload" };
  if (file.size > MAX_PDF_BYTES) return { error: "That PDF is over 4 MB. Try saving it smaller (in Word: File, Save As, PDF, Minimum size)." };
  const data = new Uint8Array(await file.arrayBuffer());
  if (Buffer.from(data.subarray(0, 5)).toString() !== "%PDF-") return { error: "That file isn't a PDF. In Word, use File, Save As, and pick PDF." };
  return { data, fileName: file.name.toLowerCase().endsWith(".pdf") ? file.name : `${file.name}.pdf` };
}

export const safeFileName = (name: string) => name.replace(/[^\w .()-]/g, "_");
