import { describe, expect, it } from "vitest";
import { MARKET_WAGES, factorKind, marketFactors, marketRateCents, roundRateCents } from "@/lib/market-rates";

describe("market rates", () => {
  it("keeps the DC-area branch at standard prices", () => {
    expect(marketFactors(MARKET_WAGES.Woodbridge!)).toEqual({ laborFactor: 1, storageFactor: 1 });
  });

  it("moves half of a rate with local wages", () => {
    // Columbus GA: $18.88 vs $27.16 moving wage; $26.51 vs $44.20 all occupations.
    expect(marketFactors(MARKET_WAGES.Columbus!)).toEqual({ laborFactor: 0.848, storageFactor: 0.8 });
  });

  it("covers all 17 branches", () => {
    expect(Object.keys(MARKET_WAGES)).toHaveLength(17);
  });

  it("applies the labor factor to crews and the storage factor to storage, nothing else", () => {
    const f = { laborFactor: 0.848, storageFactor: 0.8 };
    expect(factorKind("Project Crew Rates")).toBe("labor");
    expect(marketRateCents(5000, "Project Crew Rates", f)).toBe(4200); // $50 mover -> $42.40 -> $42
    expect(marketRateCents(175, "Storage", f)).toBe(140); // $1.75 -> $1.40
    expect(marketRateCents(4900, "Packing Materials & Moving Supplies", f)).toBe(4900);
  });

  it("rounds to whole dollars at $20 and up, otherwise to 5 cents", () => {
    expect(roundRateCents(4240)).toBe(4200);
    expect(roundRateCents(1234)).toBe(1235);
    expect(roundRateCents(2)).toBe(5);
  });
});
