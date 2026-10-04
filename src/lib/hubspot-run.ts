import { db } from "./db";
import { HubSpotError } from "./hubspot";
import { describeSync, syncHubSpot } from "./hubspot-sync";
import { open } from "./secret-box";

// Runs a sync for one company and records the outcome on the company, for the settings page.
export async function runHubSpotSync(companyId: string, actorId: string): Promise<{ ok: boolean; message: string }> {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const token = company.hubspotToken ? open(company.hubspotToken) : null;
  if (!token) return { ok: false, message: "HubSpot isn't connected. Paste a HubSpot key first." };
  // Claim the company's sync slot; a slot older than 5 minutes belongs to a sync that died.
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  const claimed = await db.company.updateMany({
    where: { id: companyId, OR: [{ hubspotSyncStartedAt: null }, { hubspotSyncStartedAt: { lt: staleBefore } }] },
    data: { hubspotSyncStartedAt: new Date() },
  });
  if (!claimed.count) return { ok: false, message: "A sync is already running. Give it a minute, then refresh." };

  let message: string;
  let ok = true;
  try {
    message = describeSync(await syncHubSpot(db, companyId, token, actorId));
  } catch (e) {
    ok = false;
    message = e instanceof HubSpotError ? e.message : "The sync stopped partway. Anything already copied is kept; run it again.";
    if (!(e instanceof HubSpotError)) console.error("HubSpot sync failed", e);
  }
  await db.company.update({
    where: { id: companyId },
    data: { hubspotSyncedAt: new Date(), hubspotSyncStartedAt: null, hubspotSyncResult: ok ? message : `Failed: ${message}` },
  });
  return { ok, message };
}
