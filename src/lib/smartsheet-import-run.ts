import "server-only";
import { db } from "./db";
import { SmartsheetError } from "./smartsheet";
import { smartsheetFor } from "./smartsheet-company";
import { describeImport, importProjects, parseImportConfig } from "./smartsheet-import";

// Runs the company's Smartsheet project import and records the outcome for Settings, Smartsheet.
export async function runSmartsheetImport(companyId: string, actorId: string): Promise<{ ok: boolean; message: string }> {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { smartsheetImport: true } });
  const config = parseImportConfig(company.smartsheetImport);
  if (!config) return { ok: false, message: "Pick a sheet and its columns first." };
  const conn = await smartsheetFor(companyId);
  if (!conn) return { ok: false, message: "Smartsheet isn't connected." };
  let ok = true;
  let message: string;
  try {
    message = describeImport(await importProjects(db, companyId, conn, config, actorId));
  } catch (e) {
    ok = false;
    message = e instanceof SmartsheetError ? e.message : "The import stopped partway. Anything already copied is kept; run it again.";
    if (!(e instanceof SmartsheetError)) console.error("Smartsheet import failed", e);
  }
  await db.company.update({
    where: { id: companyId },
    data: { smartsheetImportedAt: new Date(), smartsheetImportResult: ok ? message : `Failed: ${message}` },
  });
  return { ok, message };
}
