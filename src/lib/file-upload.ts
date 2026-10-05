// Checks for office files people upload (quotes, quote templates). Vercel caps request bodies at 4.5 MB.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  msg: "application/vnd.ms-outlook",
  eml: "message/rfc822",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export const ACCEPTED_FILES = Object.keys(TYPES).map((e) => `.${e}`).join(",");

export async function readOfficeFile(
  file: FormDataEntryValue | null,
): Promise<{ error: string } | { data: Uint8Array<ArrayBuffer>; fileName: string; contentType: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload" };
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = TYPES[ext];
  if (!contentType) return { error: `${file.name}: only Word, PDF, Excel, PowerPoint, email and picture files can be added` };
  if (file.size > MAX_FILE_BYTES) return { error: `${file.name} is over 4 MB. Try saving it smaller, or as a PDF.` };
  return { data: new Uint8Array(await file.arrayBuffer()), fileName: file.name, contentType };
}

export const fileKind = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext.startsWith("doc")) return "Word";
  if (ext.startsWith("xls") || ext === "csv") return "Excel";
  if (ext.startsWith("ppt")) return "PowerPoint";
  if (ext === "pdf") return "PDF";
  if (ext === "msg" || ext === "eml") return "Email";
  if (["png", "jpg", "jpeg"].includes(ext)) return "Picture";
  return "File";
};

// RFC 6266 header that keeps the original name, accents and all.
export function attachmentHeader(fileName: string, inline = false) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
