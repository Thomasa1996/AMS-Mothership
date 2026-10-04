import { db } from "./db";
import type { BranchContact, BranchSection, BranchWarehouse } from "./branch-import";

export type { BranchContact, BranchSection, BranchWarehouse };

function parse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function branchDetails(b: { warehouses: string; contacts: string; profile: string }) {
  return {
    warehouses: parse<BranchWarehouse[]>(b.warehouses, []),
    contacts: parse<BranchContact[]>(b.contacts, []),
    profile: parse<BranchSection[]>(b.profile, []),
  };
}

export function contactWithTitle(contacts: BranchContact[], title: string) {
  return contacts.find((c) => c.title.toLowerCase() === title.toLowerCase() && c.name) ?? null;
}

// Shown next to a market's factor: "8% below standard".
export function factorLabel(factor: number) {
  const pct = Math.round((factor - 1) * 100);
  if (pct === 0) return "Standard";
  return `${Math.abs(pct)}% ${pct < 0 ? "below" : "above"} standard`;
}

export type MarketRate = { id: string; category: string; name: string; unit: string; notes: string | null; standardCents: number; rateCents: number };

// The active rate card, priced for one market (or the standard rates when branchId is null).
export async function rateCardFor(companyId: string, branchId: string | null): Promise<MarketRate[]> {
  const items = await db.rateItem.findMany({
    where: { companyId, active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: branchId ? { marketRates: { where: { branchId, branch: { companyId } } } } : undefined,
  });
  return items.map((r) => {
    const market = "marketRates" in r ? (r.marketRates as { rateCents: number }[])[0] : undefined;
    return {
      id: r.id,
      category: r.category,
      name: r.name,
      unit: r.unit,
      notes: r.notes,
      standardCents: r.rateCents,
      rateCents: market?.rateCents ?? r.rateCents,
    };
  });
}
