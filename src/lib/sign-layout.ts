// Where each piece of a signature block goes: the signature picture, a line under it, then the
// signer's name, title, company and date. Everything is measured from the block's top-left corner in
// the same units as its width, so the page preview in the browser and the stamped PDF match.

export type SignLines = { name: string; title: string; company: string; date: string };

export type BlockItem =
  | { kind: "image"; left: number; top: number; width: number; height: number }
  | { kind: "rule"; left: number; top: number; width: number; thickness: number }
  | { kind: "text"; left: number; baseline: number; size: number; bold: boolean; text: string };

// The block's width as a share of the page width, kept within these bounds.
export const MIN_BLOCK_WIDTH = 0.12;
export const MAX_BLOCK_WIDTH = 0.9;

export function signLines(lines: SignLines) {
  return [
    { text: lines.name.trim(), bold: true },
    { text: lines.title.trim(), bold: false },
    { text: lines.company.trim(), bold: false },
    { text: lines.date.trim(), bold: false },
  ].filter((l) => l.text);
}

// aspect is the signature picture's width over its height.
export function blockLayout(width: number, aspect: number, lines: SignLines): { items: BlockItem[]; height: number } {
  const size = width * 0.055;
  const sigBox = width * 0.32;
  const ratio = aspect > 0 && Number.isFinite(aspect) ? aspect : 3;
  const imgW = Math.min(width, sigBox * ratio);
  const imgH = imgW / ratio;
  const items: BlockItem[] = [
    // Sits on the line, like a pen signature.
    { kind: "image", left: 0, top: sigBox - imgH, width: imgW, height: imgH },
    { kind: "rule", left: 0, top: sigBox + size * 0.15, width, thickness: Math.max(width * 0.004, 0.5) },
  ];
  const lineHeight = size * 1.3;
  let top = sigBox + size * 0.45;
  for (const line of signLines(lines)) {
    items.push({ kind: "text", left: 0, baseline: top + size, size, bold: line.bold, text: line.text });
    top += lineHeight;
  }
  return { items, height: top + size * 0.3 };
}

// Standard PDF fonts only cover Latin-1, so drop anything else (emoji, curly quotes become plain).
export function pdfSafeText(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e -ÿ]/g, "")
    .slice(0, 120);
}

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "America/New_York" });
export const signDate = (d: Date) => dateFormat.format(d);
