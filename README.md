# Mothership

Relocation Shephard Software: one app for a commercial moving team's CRM, operations and sales.

This is Phase 1 of the [product plan](https://claude.ai/code/artifact/43bfee9f-a31a-430d-bcb6-01b11d4e9201):

- **CRM**: accounts with owners, contacts, projects, a drag-and-drop pipeline board and an activity log.
- **Sales > Vendors**: the vendor directory, imported from the Excel vendor file (one sheet per category).
- **Team settings**: admins add teammates and set their roles.
- Operations, Sales > Quotes, Warehouse and Reports are placeholders for later phases.

Every record belongs to a company, so other moving companies can be added later with their data kept separate.

## Run it locally

Needs Node 20 or newer.

```bash
npm install
cp .env.example .env          # then set SESSION_SECRET to a long random string
npm run db:push               # create the local SQLite database
npm run db:seed               # demo company, team and sample accounts
npm run import:vendors -- "path/to/Vendor File.xlsx"   # optional
npm run dev
```

Open http://localhost:3000 and sign in as `admin@mothership.local` with password `mothership123`
(change it with `SEED_PASSWORD` before seeding). `npm run db:reset` wipes the local database and reseeds it.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Stack

Next.js 15 (App Router, server actions), TypeScript, Prisma, Tailwind CSS. SQLite for local development;
switch the datasource provider in `prisma/schema.prisma` to `postgresql` for production. Search filters use
Prisma `contains`, which is case-insensitive on SQLite but not on Postgres, so add `mode: "insensitive"` when switching.

## Layout

- `prisma/schema.prisma`: data model (Company, User, Account, Contact, Project, Activity, Vendor)
- `src/app/(app)/crm`: accounts, projects, pipeline and their server actions
- `src/app/(app)/sales/vendors`: vendor directory, editing and Excel import
- `src/lib/vendor-import.ts`: workbook parser shared by the in-app import and `scripts/import-vendors.ts`
- `src/lib/session.ts`, `src/lib/auth.ts`, `src/middleware.ts`: sign-in sessions
