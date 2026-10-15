import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { runHubSpotSync } from "@/lib/hubspot-run";
import { runSmartsheetImport } from "@/lib/smartsheet-import-run";
import { runPowerBiRevenueSync } from "@/lib/powerbi-revenue-run";
import { readQuoteDocDetails } from "@/lib/quote-doc-totals";
import { sendQuotesToHubSpot } from "@/lib/hubspot-quotes";

// Daily HubSpot sync (then quote files sent to the HubSpot companies they belong to), then the Smartsheet project import and the Power BI revenue read, for every company that has set them up
// (scheduled in vercel.json).
// Vercel sends "Authorization: Bearer <CRON_SECRET>"; without CRON_SECRET set, this does nothing.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const companies = await db.company.findMany({
    where: { OR: [{ hubspotToken: { not: null } }, { smartsheetImport: { not: null } }, { powerbiRevenue: { not: null } }] },
    select: { id: true, hubspotToken: true, hubspotQuotes: true, smartsheetImport: true, powerbiRevenue: true },
  });
  const started = Date.now();
  const results = [];
  for (const c of companies) {
    const admin = await db.user.findFirst({ where: { companyId: c.id, role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
    if (!admin) continue;
    const hubspot = c.hubspotToken ? (await runHubSpotSync(c.id, admin.id)).ok : null;
    let quotes = null;
    if (hubspot && c.hubspotQuotes) {
      // Accounts the sync just brought in may be what earlier quotes were for, so look again.
      await db.quoteDoc.updateMany({ where: { companyId: c.id, accountId: null, accountReadAt: { not: null } }, data: { accountReadAt: null } });
      await db.quoteDoc.updateMany({ where: { companyId: c.id, hubspotSentAt: null, hubspotError: { not: null } }, data: { hubspotError: null } });
      const left = () => Math.max(0, 45_000 - (Date.now() - started)) / companies.length;
      await readQuoteDocDetails(c.id, undefined, left() / 2);
      quotes = await sendQuotesToHubSpot(c.id, left());
    }
    const smartsheet = c.smartsheetImport ? (await runSmartsheetImport(c.id, admin.id)).ok : null;
    const powerbi = c.powerbiRevenue ? (await runPowerBiRevenueSync(c.id)).ok : null;
    results.push({ companyId: c.id, hubspot, quotes, smartsheet, powerbi });
  }
  return NextResponse.json({ synced: results });
}
