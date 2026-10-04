// Empties the local database (drops and recreates the public schema) so db:reset can rebuild it.
// Refuses to touch anything but a database on this machine.
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error("db:reset only runs against a local database (localhost). Check DATABASE_URL.");
  process.exit(1);
}

const db = new PrismaClient();
db.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE")
  .then(() => db.$executeRawUnsafe("CREATE SCHEMA public"))
  .then(() => console.log("Local database emptied."))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
