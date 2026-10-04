import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { runHubSpotSync } from "@/lib/hubspot-run";

// Daily HubSpot sync for every company that has connected HubSpot (scheduled in vercel.json).
// Vercel sends "Authorization: Bearer <CRON_SECRET>"; without CRON_SECRET set, this does nothing.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const companies = await db.company.findMany({ where: { hubspotToken: { not: null } }, select: { id: true } });
  const results = [];
  for (const c of companies) {
    const admin = await db.user.findFirst({ where: { companyId: c.id, role: "ADMIN" }, orderBy: { createdAt: "asc" } });
    if (!admin) continue;
    const r = await runHubSpotSync(c.id, admin.id);
    results.push({ companyId: c.id, ok: r.ok });
  }
  return NextResponse.json({ synced: results });
}
