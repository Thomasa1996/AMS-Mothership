import { describe, expect, it } from "vitest";
import { forecastByMarket } from "@/lib/market-forecast";

const d = (branchId: string | null, dollars: number | null, outcome: string | null = null) => ({ branchId, totalCents: dollars === null ? null : dollars * 100, outcome });

describe("forecastByMarket", () => {
  it("weights open proposals by the market's own win rate once it has enough decided", () => {
    const [sa] = forecastByMarket([d("sa", 100, "WON"), d("sa", 100, "WON"), d("sa", 100, "LOST"), d("sa", 300)]);
    expect(sa.winRate).toBeCloseTo(2 / 3);
    expect(sa.ownRate).toBe(true);
    expect(sa.forecastCents).toBe(20000 + 20000);
  });

  it("uses the company win rate for a market with few decided proposals", () => {
    const rows = forecastByMarket([d("a", 100, "WON"), d("a", 100, "WON"), d("a", 100, "WON"), d("a", 100, "LOST"), d("b", 1000, "LOST"), d("b", 400)]);
    const b = rows.find((r) => r.branchId === "b")!;
    expect(b.ownRate).toBe(false);
    expect(b.winRate).toBeCloseTo(3 / 5);
    expect(b.forecastCents).toBe(24000);
  });

  it("puts proposals with no market last and counts ones without a total as $0", () => {
    const rows = forecastByMarket([d(null, 5000), d("a", null), d("a", 10)]);
    expect(rows.map((r) => r.branchId)).toEqual(["a", null]);
    expect(rows[0].proposals).toBe(2);
    expect(rows[0].openCents).toBe(1000);
    expect(rows[1].winRate).toBeNull();
  });
});
