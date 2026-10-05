import "server-only";
import { db } from "./db";
import { open } from "./secret-box";
import { PowerBiError, fillMonths, getToken, parseRevenueSource, revenueQuery, rowsToMonths, runQuery, type PowerBiCreds } from "./powerbi-api";

export async function powerBiCreds(companyId: string): Promise<PowerBiCreds | null> {
  const c = await db.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { powerbiTenantId: true, powerbiClientId: true, powerbiSecret: true },
  });
  const secret = c.powerbiSecret ? open(c.powerbiSecret) : null;
  return c.powerbiTenantId && c.powerbiClientId && secret ? { tenantId: c.powerbiTenantId, clientId: c.powerbiClientId, secret } : null;
}

// Reads each revenue line by month from Power BI into PowerBiRevenue for Revenue > Year over year,
// and records the outcome for Settings > Power BI.
export async function runPowerBiRevenueSync(companyId: string): Promise<{ ok: boolean; message: string }> {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { powerbiRevenue: true } });
  const source = parseRevenueSource(company.powerbiRevenue);
  const creds = await powerBiCreds(companyId);
  if (!creds) return { ok: false, message: "Power BI isn't connected." };
  const series = source?.series.filter((x) => x.name.trim() && x.amount.trim()) ?? [];
  if (!source || !source.dateColumn || !series.length) return { ok: false, message: "Pick the dataset, date and revenue lines first." };

  let ok = true;
  let message: string;
  try {
    const token = await getToken(creds);
    const now = new Date();
    const rows = await runQuery(token, source.groupId, source.datasetId, revenueQuery(source.dateColumn, series, now.getUTCFullYear() - 3));
    const through = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
    const lines = rowsToMonths(rows, series.length).map((months, i) => ({ name: series[i].name.trim(), months: fillMonths(months, through) }));
    const thisYear = (l: (typeof lines)[number]) => l.months.filter((m) => m.year === through.year).reduce((s, m) => s + m.amount, 0);
    const empty = lines.filter((l) => !l.months.length).map((l) => l.name);
    message = `${through.year} so far: ${lines.map((l) => `${l.name} $${thisYear(l).toLocaleString()}`).join(", ")}.`;
    if (empty.length === lines.length) {
      ok = false;
      message = "Power BI returned no revenue. Check the date column and revenue lines you picked.";
    } else {
      if (empty.length) message += ` No data came back for ${empty.join(", ")}.`;
      await db.$transaction([
        db.powerBiRevenue.deleteMany({ where: { companyId } }),
        db.powerBiRevenue.createMany({
          data: lines.flatMap((l) => l.months.map((m) => ({ companyId, series: l.name, year: m.year, month: m.month, amount: m.amount }))),
        }),
      ]);
    }
  } catch (e) {
    ok = false;
    message = e instanceof PowerBiError ? e.message : "The Power BI sync failed. Try again.";
    if (!(e instanceof PowerBiError)) console.error("Power BI sync failed", e);
  }
  await db.company.update({ where: { id: companyId }, data: { powerbiSyncedAt: new Date(), powerbiSyncResult: ok ? message : `Failed: ${message}` } });
  return { ok, message };
}
