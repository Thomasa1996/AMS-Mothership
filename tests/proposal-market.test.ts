import { describe, expect, it } from "vitest";
import { findMarket, marketNames } from "@/lib/proposal-market";

const m = (id: string, name: string, cities: string[] = []) => ({ id, name, warehouses: JSON.stringify(cities.map((c) => ({ cityStateZip: c }))) });
const markets = [
  m("ches", "Chesapeake", ["Norfolk, Va 23504", "Chesapeake, Va 23323"]),
  m("fwb", "Ft. Walton Beach", ["Ft Walton Beach FL 32548"]),
  m("hin", "Hinesville", ["WALTHOURVILLE,GA 31333"]),
  m("kil", "Killeen", ["Killeen TX 76543"]),
  m("sa", "San Antonio", ["San Antonio, TX"]),
];

describe("findMarket", () => {
  it("finds the market named in the proposal", () => {
    expect(findMarket("Relocation of the clinic at 400 Main St, San Antonio, TX 78201", markets)?.id).toBe("sa");
  });
  it("counts warehouse cities and Fort spelled out", () => {
    expect(findMarket("Move from Norfolk naval station", markets)?.id).toBe("ches");
    expect(findMarket("Fort Walton Beach office move", markets)?.id).toBe("fwb");
    expect(findMarket("Storage in Walthourville", markets)?.id).toBe("hin");
  });
  it("picks the market named most when several appear", () => {
    expect(findMarket("Apple Moving, Killeen TX. Job site: San Antonio. Crew from San Antonio branch.", markets)?.id).toBe("sa");
  });
  it("returns null when no market is named", () => {
    expect(findMarket("Office move in Denver", markets)).toBeNull();
  });
  it("lists a market's names", () => {
    expect(marketNames(markets[0])).toEqual(["chesapeake", "norfolk"]);
    expect(marketNames(markets[3])).toEqual(["killeen"]);
  });
});
