import { z } from "zod";

// Quote money math. Everything is in integer cents so totals never drift.

export const QUOTE_STATUSES = [
  { id: "DRAFT", label: "Draft" },
  { id: "SENT", label: "Sent" },
  { id: "ACCEPTED", label: "Accepted" },
  { id: "DECLINED", label: "Declined" },
] as const;

export const QUOTE_STATUS_IDS = QUOTE_STATUSES.map((s) => s.id) as [string, ...string[]];

export function quoteStatusLabel(id: string): string {
  return QUOTE_STATUSES.find((s) => s.id === id)?.label ?? id;
}

export function lineAmountCents(quantity: number, rateCents: number): number {
  return Math.round(quantity * rateCents);
}

// The Firm Fixed Project Total is the sum of the priced lines.
export function quoteTotalCents(lines: { quantity: number; rateCents: number }[]): number {
  return lines.reduce((sum, l) => sum + lineAmountCents(l.quantity, l.rateCents), 0);
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function formatQuantity(q: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(q);
}

// What the client sees in brackets after a line's price: the line's note, or for
// quantity-based lines the math, e.g. "9,750 sq. ft. at $1.80 per sq. ft.".
export function lineDetail(line: { quantity: number; unit: string; rateCents: number; note?: string | null }): string | null {
  if (line.note?.trim()) return line.note.trim();
  if (line.quantity === 1 || line.unit === "flat") return null;
  return `${formatQuantity(line.quantity)} ${line.unit} at ${formatCents(line.rateCents)} per ${line.unit}`;
}

// "1,250.50" or "$1250.5" -> 125050. Returns null when it isn't a non-negative amount.
export function parseDollarsToCents(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

const text = (max = 20000) => z.string().trim().max(max);
const optional = (max = 20000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

export const QuoteLineInput = z.object({
  category: text(200).default(""),
  description: text(500).min(1, "Every price line needs a description"),
  quantity: z.number().finite().min(0, "Quantities can't be negative"),
  unit: text(100).min(1, "Every price line needs a unit"),
  rateCents: z.number().int().min(0, "Rates can't be negative"),
  note: optional(500),
});

export const QuoteInput = z.object({
  projectId: z.string().min(1, "Choose a project"),
  title: text(300).min(1, "Give the quote a title"),
  quoteDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the quote date")
    .transform((v) => new Date(`${v}T00:00:00.000Z`)),
  recipientName: optional(200),
  recipientTitle: optional(200),
  recipientCompany: optional(200),
  recipientPhone: optional(100),
  recipientEmail: optional(200),
  clientLogo: optional(2_000_000),
  clientLabel: text(200).min(1, "Enter who the client is (used in their responsibilities)"),
  serviceDescription: text(500).min(1, "Describe the service"),
  intro: text().min(1, "The introduction can't be empty"),
  scopeTitle: text(300).min(1, "Give the scope section a title"),
  timeline: optional(300),
  scope: optional(),
  investmentHeading: text(500).min(1, "Enter the investment heading"),
  totalLabel: text(200).min(1, "Enter the total label"),
  valuation: text().min(1, "The valuation clause can't be empty"),
  optionalValuation: optional(),
  companyDuties: text(),
  clientDuties: text(),
  lines: z.array(QuoteLineInput).min(1, "Add at least one price line"),
});

export type QuoteInputType = z.input<typeof QuoteInput>;
