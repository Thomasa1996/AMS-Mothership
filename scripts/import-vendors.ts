// Imports a vendor workbook into the first company (or the one named by COMPANY_NAME).
// Usage: npm run import:vendors -- "path/to/Vendor File.xlsx" [--append]
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { parseVendorWorkbook } from "../src/lib/vendor-import";

const db = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error('Usage: npm run import:vendors -- "path/to/file.xlsx" [--append]');
  const append = args.includes("--append");

  const company = process.env.COMPANY_NAME
    ? await db.company.findFirst({ where: { name: process.env.COMPANY_NAME } })
    : await db.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) throw new Error("No company found; run npm run db:seed first");

  const rows = await parseVendorWorkbook(await readFile(file));
  await db.$transaction([
    ...(append ? [] : [db.vendor.deleteMany({ where: { companyId: company.id } })]),
    db.vendor.createMany({ data: rows.map((r) => ({ ...r, companyId: company.id })) }),
  ]);
  const categories = new Set(rows.map((r) => r.category)).size;
  console.log(`Imported ${rows.length} vendor contacts across ${categories} categories into ${company.name}.`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
