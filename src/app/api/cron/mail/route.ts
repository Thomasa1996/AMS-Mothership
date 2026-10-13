import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { runMailProposalSync } from "@/lib/mail-proposals-run";

// Daily pull of proposals from reps' sent email, for every company that has connected Microsoft 365
// (scheduled in vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>"; without CRON_SECRET set, this does nothing.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const companies = await db.company.findMany({ where: { mailSecret: { not: null } }, select: { id: true } });
  const results = [];
  for (const c of companies) results.push({ companyId: c.id, ...(await runMailProposalSync(c.id, 50_000 / companies.length)) });
  return NextResponse.json({ synced: results });
}
