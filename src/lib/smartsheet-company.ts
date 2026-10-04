import { db } from "./db";
import { open } from "./secret-box";

// The company's Smartsheet connection, or null when none is set up (or the token can't be read).
export async function smartsheetFor(companyId: string) {
  const c = await db.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { smartsheetToken: true, smartsheetRegion: true, smartsheetSheetIds: true },
  });
  const token = c.smartsheetToken ? open(c.smartsheetToken) : null;
  if (!token) return null;
  return { token, region: c.smartsheetRegion, sheetIds: parseSheetIds(c.smartsheetSheetIds) };
}

export function parseSheetIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.map(String) : [];
  } catch {
    return [];
  }
}

// An empty list means every sheet the token can see is shown.
export const sheetVisible = (sheetIds: string[], id: string | number) => sheetIds.length === 0 || sheetIds.includes(String(id));
