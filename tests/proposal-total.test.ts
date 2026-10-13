import { describe, expect, it } from "vitest";
import { findProposalTotal } from "@/lib/proposal-total";

describe("findProposalTotal", () => {
  it("reads the project total from a Mothership proposal", () => {
    const text = [
      "Relocation of imaging equipment: $16,260.00 (includes 6 months of storage)",
      "Warehouse Handling: $17,062.50 (9,750 sq. ft. at $1.75 per sq. ft.)",
      "Firm Fixed Project Total: $33,322.50",
      "not to exceed the sum of $0.60 per pound per item for furniture and $5.00 per pound",
      "Minimum valuation is $20,000.",
    ].join("\n");
    expect(findProposalTotal(text)).toBe(3332250);
  });

  it("prefers a grand total over subtotals", () => {
    expect(findProposalTotal("Subtotal $9,000\nTax $500\nGrand Total $9,500\nTotal hours 40")).toBe(950000);
  });

  it("takes the amount on the next line when the label stands alone", () => {
    expect(findProposalTotal("Labor $4,000\nTotal\n$4,000.00")).toBe(400000);
  });

  it("falls back to a subtotal, and gives up when nothing reads like a total", () => {
    expect(findProposalTotal("Movers $1,200\nSubtotal: $1,200")).toBe(120000);
    expect(findProposalTotal("Movers $1,200\nTrucks $800")).toBeNull();
  });

  it("ignores total lines about coverage", () => {
    expect(findProposalTotal("Total coverage not to exceed $100,000\nTotal: $2,500")).toBe(250000);
  });
});
