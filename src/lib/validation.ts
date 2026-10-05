import { z } from "zod";
import { ACCOUNT_SOURCES, ACTIVITY_TYPES, STAGE_IDS } from "./constants";

// Form fields arrive as strings; blank optional fields become null.
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const requiredText = (what: string) => z.string().trim().min(1, `${what} is required`);

// Accepts "12000", "$12,000" or "12,000.50"; stored as whole dollars.
export const moneyField = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const cleaned = (v ?? "").replace(/[$,\s]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a dollar amount" });
      return z.NEVER;
    }
    return Math.round(n);
  });

// Accepts "YYYY-MM-DD" from <input type="date">; stored as midnight UTC.
export const dateField = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid date" });
      return z.NEVER;
    }
    const d = new Date(`${v}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid date" });
      return z.NEVER;
    }
    return d;
  });

const sourceIds = ACCOUNT_SOURCES.map((s) => s.id) as [string, ...string[]];
const activityIds = ACTIVITY_TYPES.map((a) => a.id) as [string, ...string[]];

export const AccountSchema = z.object({
  name: requiredText("Company name"),
  industry: optionalText,
  website: optionalText,
  phone: optionalText,
  address: optionalText,
  source: z.enum(sourceIds).default("MANUAL"),
  ownerId: optionalText,
});

export const ContactSchema = z.object({
  name: requiredText("Contact name"),
  title: optionalText,
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email"),
  phone: optionalText,
  isPrimary: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export const ProjectSchema = z.object({
  accountId: requiredText("Account"),
  name: requiredText("Project name"),
  stage: z.enum(STAGE_IDS).default("LEAD"),
  originAddress: optionalText,
  destinationAddress: optionalText,
  moveDate: dateField,
  estimatedValue: moneyField,
  managerId: optionalText,
  notes: optionalText,
});

export const ActivitySchema = z.object({
  type: z.enum(activityIds).default("NOTE"),
  body: requiredText("Note"),
});

export const StageSchema = z.enum(STAGE_IDS);

export type FormState = { error?: string; ok?: boolean };

export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  }
  return out;
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again";
}
