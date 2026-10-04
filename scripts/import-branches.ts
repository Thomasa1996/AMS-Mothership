// Imports the branch profile workbook into the first company (or the one named by COMPANY_NAME),
// and sets each new branch's market rate card from lib/market-rates.ts.
// Usage: npm run import:branches -- "path/to/Branch Profiles.xlsx"
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { parseBranchWorkbook } from "../src/lib/branch-import";
import { saveBranches } from "../src/lib/branch-save";

const db = new PrismaClient();

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: npm run import:branches -- "path/to/file.xlsx"');
  const company = process.env.COMPANY_NAME
    ? await db.company.findFirst({ where: { name: process.env.COMPANY_NAME } })
    : await db.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) throw new Error("No company found; run npm run db:seed first");

  const rows = await parseBranchWorkbook(await readFile(file));
  const { created, updated } = await saveBranches(db, company.id, rows);
  console.log(`Imported ${rows.length} branches into ${company.name} (${created} new, ${updated} updated).`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
