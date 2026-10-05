export const STAGES = [
  { id: "LEAD", label: "Lead" },
  { id: "SURVEY", label: "Site survey" },
  { id: "QUOTED", label: "Quoted" },
  { id: "BOOKED", label: "Booked" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "COMPLETED", label: "Completed" },
  { id: "LOST", label: "Lost" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export const STAGE_IDS = STAGES.map((s) => s.id) as [StageId, ...StageId[]];

export function stageLabel(id: string): string {
  return STAGES.find((s) => s.id === id)?.label ?? id;
}

export const ROLES = [
  { id: "ADMIN", label: "Admin" },
  { id: "SALES", label: "Sales rep" },
  { id: "PROJECT_MANAGER", label: "Project manager" },
  { id: "WAREHOUSE", label: "Warehouse lead" },
  { id: "CREW", label: "Crew lead" },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

export function roleLabel(id: string): string {
  return ROLES.find((r) => r.id === id)?.label ?? id;
}

export const ACTIVITY_TYPES = [
  { id: "NOTE", label: "Note" },
  { id: "CALL", label: "Call" },
  { id: "EMAIL", label: "Email" },
  { id: "MEETING", label: "Meeting" },
] as const;

export const ACCOUNT_SOURCES = [
  { id: "MANUAL", label: "Manual" },
  { id: "APOLLO", label: "Apollo" },
  { id: "HUBSPOT", label: "HubSpot" },
  { id: "SMARTSHEET", label: "Smartsheet" },
] as const;

export const sourceLabel = (id: string) => ACCOUNT_SOURCES.find((s) => s.id === id)?.label ?? id;

export const INDUSTRIES = [
  "Corporate office",
  "Law firm",
  "Healthcare",
  "Education",
  "Government",
  "Technology",
  "Financial services",
  "Retail",
  "Industrial",
  "Other",
];

// Shown for vendor rows imported without a company name.
export const MISSING_COMPANY = "Company not listed";

// Stages that count as won business for revenue.
export const WON_STAGES: StageId[] = ["BOOKED", "IN_PROGRESS", "COMPLETED"];

// Stamps the won date when a project first moves into a won stage, and clears it if it falls back out.
export function closedAtFor(prevStage: string | null, nextStage: string, current: Date | null): { closedAt?: Date | null } {
  const wasWon = prevStage != null && (WON_STAGES as string[]).includes(prevStage);
  const isWon = (WON_STAGES as string[]).includes(nextStage);
  if (isWon && !wasWon) return current ? {} : { closedAt: new Date() };
  if (!isWon && wasWon) return { closedAt: null };
  return {};
}
