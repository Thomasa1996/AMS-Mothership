// CRM project fields the Smartsheet import can fill, with column titles it guesses for each.
export const IMPORT_FIELDS = [
  { id: "name", label: "Project name", required: true, guess: ["project name", "project", "job name", "job", "name"] },
  { id: "company", label: "Client / company", required: true, guess: ["client", "company", "customer", "account", "client name"] },
  { id: "owner", label: "Sales rep (owner)", guess: ["sales rep", "salesperson", "account owner", "owner", "rep"] },
  { id: "manager", label: "Project manager", guess: ["project manager", "pm", "manager"] },
  { id: "stage", label: "Status", guess: ["status", "stage", "project status"] },
  { id: "moveDate", label: "Move date", guess: ["move date", "start date", "date", "start"] },
  { id: "value", label: "Project value ($)", guess: ["value", "amount", "contract value", "revenue", "price", "total"] },
  { id: "origin", label: "Moving from", guess: ["origin", "from", "origin address", "moving from"] },
  { id: "destination", label: "Moving to", guess: ["destination", "to", "destination address", "moving to"] },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["id"];
export type ImportConfig = { sheetId: string; columns: Partial<Record<ImportField, string>> };

