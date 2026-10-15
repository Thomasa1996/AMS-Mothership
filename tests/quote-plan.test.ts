import { describe, expect, it } from "vitest";
import {
  PlanDay,
  PlanMaterial,
  analyzePlan,
  crewHeadline,
  crewLabel,
  crewRateCents,
  dayLaborCents,
  materialsCents,
  planInvestmentRows,
  planTotalCents,
  readPlan,
  travelPlan,
  travelSentence,
  truckMinutes,
} from "@/lib/quote-plan";
import { QuoteInput, fullQuoteTotalCents } from "@/lib/quote-math";

// Tim Ferrell's Gaithersburg to Chantilly quote (10.15.2026): 5 crew, 8 hours, $2,892 total.
const timDay = PlanDay.parse({
  title: "Pick Up, Delivery, Set Up and Safe Removal",
  date: "Tuesday, October 20th, 2026",
  startTime: "6:00 AM – 7:00 AM at Gaithersburg",
  origin: "9737 Washingtonian Blvd, 4th floor, Gaithersburg, MD",
  destination: "14668 Lee Road, 1st floor, Chantilly, VA (LCIII)",
  crew: [
    { role: "Truck & Driver", count: 1, rateCents: 9500 },
    { role: "Project Supervisor", count: 1, rateCents: 6000 },
    { role: "Mover", count: 3, rateCents: 4400 },
  ],
  hours: 8,
  trucks: 1,
  truckLabel: "Straight Truck w/liftgate",
});

const timMaterials = [
  { name: "Fuel Surcharge", quantity: 1, unit: "truck", rateCents: 7500 },
  { name: "Tape", quantity: 2, unit: "roll", rateCents: 800 },
  { name: "Stretch wrap", quantity: 1, unit: "roll", rateCents: 5500, note: "to protect and double stack chairs" },
  { name: "Dollies", quantity: 30, unit: "each", rateCents: 100, free: true },
  { name: "Panel cart", quantity: 1, unit: "each", rateCents: 600, free: true },
  { name: "Safe jack", quantity: 1, unit: "each", rateCents: 0, free: true },
].map((m) => PlanMaterial.parse(m));

describe("crew and day labor", () => {
  it("prices the crew like Tim's quote: $287/hr x 8 = $2,296", () => {
    expect(crewRateCents(timDay.crew)).toBe(28700);
    expect(dayLaborCents(timDay)).toBe(229600);
  });

  it("prices a Lee Road decommission day: $817/hr x 8 = $6,536", () => {
    const crew = [
      { role: "Project Director", count: 1, rateCents: 12000 },
      { role: "Truck & Driver", count: 3, rateCents: 9500 },
      { role: "Project Manager", count: 1, rateCents: 8000 },
      { role: "Mover", count: 3, rateCents: 4400 },
      { role: "Installer", count: 4, rateCents: 5000 },
    ];
    expect(crewRateCents(crew)).toBe(81700);
    expect(dayLaborCents({ crew, hours: 8 })).toBe(653600);
  });

  it("writes the crew lines the way the proposal does", () => {
    expect(crewLabel({ role: "Mover", count: 3 })).toBe("(3) Movers");
    expect(crewLabel({ role: "Truck & Driver", count: 2 })).toBe("(2) Truck & Driver");
    expect(crewLabel({ role: "Project Supervisor", count: 1 })).toBe("(1) Project Supervisor");
    expect(crewHeadline(timDay)).toBe("5 Moving Specialists and 1 Straight Truck w/liftgate for 8 hours including travel");
  });
});

describe("materials and totals", () => {
  it("charges only the priced materials: fuel $75 + tape $16 + stretch wrap $55 = $146", () => {
    expect(materialsCents(timMaterials)).toBe(14600);
  });

  it("totals Tim's quote at $2,892 with the $450 safe recycling fee as a price line", () => {
    const plan = { days: [timDay], materials: timMaterials };
    expect(planTotalCents(plan)).toBe(244200);
    expect(fullQuoteTotalCents([{ quantity: 1, rateCents: 45000 }], plan)).toBe(289200);
    expect(planInvestmentRows(plan)).toEqual([
      { label: "Pick Up, Delivery, Set Up and Safe Removal Labor", amountCents: 229600 },
      { label: "Materials and Equipment", amountCents: 14600 },
    ]);
  });
});

describe("travel planner", () => {
  it("adds a 25% truck buffer to car time", () => {
    expect(truckMinutes(60)).toBe(75);
    expect(truckMinutes(45, 25)).toBe(57);
  });

  it("works back from the 9:30 AM arrival: depart by 8:15, start loading by 6:45", () => {
    const t = { carMinutes: 60, bufferPct: 25, loadMinutes: 90, arriveBy: "09:30" };
    expect(travelPlan(t)).toEqual({ truckMinutes: 75, departBy: "8:15 AM", latestStart: "6:45 AM" });
    expect(travelSentence(t)).toContain("75 minutes: 60 minutes car time plus a 25% buffer");
  });
});

describe("cost analysis", () => {
  it("gives the blended rate per man and per-truck costs", () => {
    const day = { ...timDay, loads: 2 };
    const a = analyzePlan({ days: [day], materials: timMaterials }, 45000);
    expect(a.days[0]!.blendedRateCents).toBe(5740); // $287 / 5 people
    expect(a.days[0]!.loadAndGoPerTruckCents).toBe(90800); // ($95 + 3 x $44) x 8 / 2 loads
    expect(a.allInPerTruckCents).toBe(144600); // $2,892 / 2 loads
  });
});

describe("quote input", () => {
  const base = {
    projectId: "p",
    title: "Furniture delivery",
    quoteDate: "2026-10-15",
    clientLabel: "JLL",
    serviceDescription: "furniture delivery",
    intro: "Thanks",
    scopeTitle: "Scope",
    investmentHeading: "Investment",
    totalLabel: "Project Total",
    valuation: "Valuation",
    companyDuties: "",
    clientDuties: "",
  };

  it("accepts a quote priced only from the schedule", () => {
    const r = QuoteInput.safeParse({ ...base, lines: [], plan: { days: [timDay] } });
    expect(r.success).toBe(true);
  });

  it("still needs something to price", () => {
    const r = QuoteInput.safeParse({ ...base, lines: [] });
    expect(r.success).toBe(false);
  });

  it("reads old quotes without a plan as empty", () => {
    expect(readPlan(null).days).toEqual([]);
    expect(readPlan({ nonsense: true }).materials).toEqual([]);
  });
});
