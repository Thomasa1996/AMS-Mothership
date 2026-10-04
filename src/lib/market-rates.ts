// Market pricing for each branch, relative to the standard rate sheet.
//
// The standard 2026 rate sheet is priced for the DC / Northern Virginia market (its travel and fuel
// rules name VA, MD and DC), so the Washington metro is the 1.00 baseline.
//
// Source: BLS Occupational Employment and Wage Statistics, May 2025, per-metro news releases.
// - Labor-driven rates follow the mean hourly wage for Transportation and Material Moving occupations.
// - Storage follows the mean hourly wage for all occupations, a stand-in for the local cost of space
//   and overhead, since warehouse rents aren't published for most of these markets.
// Only half of a billed rate moves with local wages (trucks, fuel, insurance, equipment and margin
// cost about the same everywhere), so: factor = 0.5 + 0.5 × (local wage ÷ DC wage).

export const BASELINE = { area: "Washington-Arlington-Alexandria, DC-VA-MD-WV", movingWage: 27.16, allWage: 44.2 };
export const WAGE_SOURCE = "BLS Occupational Employment and Wage Statistics, May 2025";
export const WAGE_SHARE = 0.5;

export type MarketWage = {
  // Metro area the wages come from. Nonmetro branches use the nearest similar metro.
  area: string;
  proxy?: string;
  movingWage: number;
  allWage: number;
};

// Keyed by the branch sheet name in the profile workbook.
export const MARKET_WAGES: Record<string, MarketWage> = {
  Augusta: { area: "Augusta-Richmond County, GA-SC", movingWage: 20.19, allWage: 28.85 },
  Austin: { area: "Austin-Round Rock-San Marcos, TX", movingWage: 21.9, allWage: 35.85 },
  Chesapeake: { area: "Virginia Beach-Chesapeake-Norfolk, VA-NC", movingWage: 22.9, allWage: 30.83 },
  "Colorado Springs": { area: "Colorado Springs, CO", movingWage: 23.49, allWage: 34.03 },
  "Corpus Christi": { area: "Corpus Christi, TX", movingWage: 21.43, allWage: 27.73 },
  Columbus: { area: "Columbus, GA-AL", movingWage: 18.88, allWage: 26.51 },
  "El Paso": { area: "El Paso, TX", movingWage: 20.01, allWage: 24.94 },
  "Del Rio": { area: "Laredo, TX", proxy: "Del Rio has no metro wage survey; Laredo is the nearest border metro", movingWage: 20.53, allWage: 23.17 },
  Fayetteville: { area: "Fayetteville, NC", movingWage: 19.85, allWage: 27.96 },
  "Ft. Walton Beach": { area: "Crestview-Fort Walton Beach-Destin, FL", movingWage: 21.54, allWage: 30.33 },
  Hinesville: { area: "Hinesville, GA", movingWage: 21.48, allWage: 26.04 },
  Killeen: { area: "Killeen-Temple, TX", movingWage: 21.66, allWage: 29.99 },
  Leesville: { area: "Alexandria, LA", proxy: "Leesville has no metro wage survey; Alexandria, LA is the nearest metro", movingWage: 18.67, allWage: 24.82 },
  Macon: { area: "Macon-Bibb County, GA", movingWage: 19.96, allWage: 27.11 },
  "San Antonio": { area: "San Antonio-New Braunfels, TX", movingWage: 21.23, allWage: 29.39 },
  Winters: { area: "Lubbock, TX", proxy: "Winters has no metro wage survey; Lubbock is the nearest West Texas metro surveyed", movingWage: 19.92, allWage: 25.89 },
  Woodbridge: { area: BASELINE.area, movingWage: BASELINE.movingWage, allWage: BASELINE.allWage },
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function marketFactors(w: MarketWage) {
  return {
    laborFactor: round3(1 - WAGE_SHARE + (WAGE_SHARE * w.movingWage) / BASELINE.movingWage),
    storageFactor: round3(1 - WAGE_SHARE + (WAGE_SHARE * w.allWage) / BASELINE.allWage),
  };
}

export function marketNotes(w: MarketWage) {
  const lines = [
    `Wages: ${w.area} (${WAGE_SOURCE}). Moving and material moving workers $${w.movingWage.toFixed(2)}/hr vs $${BASELINE.movingWage.toFixed(2)} in the DC metro; all occupations $${w.allWage.toFixed(2)}/hr vs $${BASELINE.allWage.toFixed(2)}.`,
  ];
  if (w.proxy) lines.push(w.proxy + ".");
  return lines.join("\n");
}

// Which factor applies to each rate card category. Materials, rentals, disposal and fees are
// priced the same everywhere.
const LABOR_CATEGORIES = new Set(["Small Job Rates", "Project Crew Rates", "IT Technical Services", "Delivery & Pick-up"]);
const STORAGE_CATEGORIES = new Set(["Storage"]);

export function factorKind(category: string): "labor" | "storage" | null {
  if (LABOR_CATEGORIES.has(category)) return "labor";
  if (STORAGE_CATEGORIES.has(category)) return "storage";
  return null;
}

// Rates of $20 or more round to whole dollars; smaller rates to the nearest 5 cents.
export function roundRateCents(cents: number) {
  if (cents >= 2000) return Math.round(cents / 100) * 100;
  return Math.max(5, Math.round(cents / 5) * 5);
}

export function marketRateCents(baseCents: number, category: string, f: { laborFactor: number; storageFactor: number }) {
  const kind = factorKind(category);
  if (!kind) return baseCents;
  return roundRateCents(baseCents * (kind === "labor" ? f.laborFactor : f.storageFactor));
}
