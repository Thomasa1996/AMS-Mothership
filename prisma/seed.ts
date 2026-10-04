// Seeds a demo company, team and sample CRM data for local development.
// Run with: npm run db:seed (or npm run db:reset to wipe and reseed).
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "mothership123";

function day(offset: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

async function main() {
  if (await db.company.count()) {
    console.log("Database already has data; run npm run db:reset to start over.");
    return;
  }
  const company = await db.company.create({ data: { name: "Apple Moving" } });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const mk = (name: string, email: string, role: string) =>
    db.user.create({ data: { companyId: company.id, name, email, role, passwordHash } });

  const thomas = await mk("Thomas Anderson", "admin@mothership.local", "ADMIN");
  const sarah = await mk("Sarah Kim", "sarah@mothership.local", "SALES");
  const marcus = await mk("Marcus Reed", "marcus@mothership.local", "SALES");
  const dana = await mk("Dana Ortiz", "dana@mothership.local", "PROJECT_MANAGER");
  await mk("Luis Gomez", "luis@mothership.local", "WAREHOUSE");

  const accounts = [
    {
      name: "Hartwell & Lowe LLP", industry: "Law firm", owner: thomas, phone: "(202) 555-0142",
      address: "1700 K Street NW, Washington, DC 20006", source: "HUBSPOT",
      contacts: [{ name: "Patricia Lowe", title: "Office Manager", email: "plowe@hartwell-lowe.example", isPrimary: true }],
      projects: [
        { name: "HQ relocation, floors 4-6", stage: "QUOTED", value: 86000, date: 45, from: "1700 K Street NW", to: "2100 Pennsylvania Ave NW" },
      ],
    },
    {
      name: "Meridian Health Partners", industry: "Healthcare", owner: sarah, phone: "(301) 555-0199",
      address: "9600 Medical Center Dr, Rockville, MD 20850", source: "APOLLO",
      contacts: [
        { name: "James Whitfield", title: "Facilities Director", email: "jwhitfield@meridianhp.example", isPrimary: true },
        { name: "Angela Brooks", title: "Practice Administrator", email: "abrooks@meridianhp.example", isPrimary: false },
      ],
      projects: [
        { name: "Clinic consolidation", stage: "BOOKED", value: 54000, date: 18, from: "Gaithersburg clinic", to: "Rockville campus" },
        { name: "Imaging equipment move", stage: "SURVEY", value: 22000, date: 70, from: "Building B", to: "Building D" },
      ],
    },
    {
      name: "Northbridge Technologies", industry: "Technology", owner: marcus, phone: "(703) 555-0110",
      address: "11950 Freedom Dr, Reston, VA 20190", source: "APOLLO",
      contacts: [{ name: "Priya Raman", title: "Workplace Experience Lead", email: "praman@northbridge.example", isPrimary: true }],
      projects: [
        { name: "Reston office expansion", stage: "LEAD", value: 40000, date: null, from: null, to: "11950 Freedom Dr, 3rd floor" },
        { name: "Data center decommission", stage: "IN_PROGRESS", value: 31000, date: 3, from: "Ashburn DC1", to: "Warehouse storage" },
      ],
    },
    {
      name: "Capitol Federal Credit Union", industry: "Financial services", owner: sarah, phone: "(202) 555-0177",
      address: "500 E Street SW, Washington, DC 20024", source: "MANUAL",
      contacts: [{ name: "Robert Chen", title: "VP Operations", email: "rchen@capfcu.example", isPrimary: true }],
      projects: [
        { name: "Branch refresh, 6 locations", stage: "COMPLETED", value: 64000, date: -20, from: "Various branches", to: "Various branches" },
        { name: "Records storage", stage: "LOST", value: 12000, date: null, from: null, to: null },
      ],
    },
    {
      name: "Fairfax County Public Schools", industry: "Education", owner: thomas, phone: "(571) 555-0123",
      address: "8115 Gatehouse Rd, Falls Church, VA 22042", source: "MANUAL",
      contacts: [{ name: "Linda Okafor", title: "Procurement Officer", email: "lokafor@fcps.example", isPrimary: true }],
      projects: [
        { name: "Summer classroom moves", stage: "QUOTED", value: 120000, date: 240, from: "Multiple schools", to: "Multiple schools" },
      ],
    },
  ];

  for (const a of accounts) {
    const account = await db.account.create({
      data: {
        companyId: company.id, name: a.name, industry: a.industry, ownerId: a.owner.id,
        phone: a.phone, address: a.address, source: a.source,
      },
    });
    for (const c of a.contacts) {
      await db.contact.create({ data: { ...c, companyId: company.id, accountId: account.id } });
    }
    for (const p of a.projects) {
      const project = await db.project.create({
        data: {
          companyId: company.id, accountId: account.id, name: p.name, stage: p.stage,
          estimatedValue: p.value, moveDate: p.date == null ? null : day(p.date),
          originAddress: p.from, destinationAddress: p.to, managerId: dana.id,
        },
      });
      await db.activity.create({
        data: {
          companyId: company.id, accountId: account.id, projectId: project.id, userId: a.owner.id,
          type: "CALL", body: `Walked through scope for ${p.name.toLowerCase()} with the client.`,
        },
      });
    }
  }

  console.log(`Seeded ${company.name}. Sign in as admin@mothership.local with password "${DEMO_PASSWORD}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
