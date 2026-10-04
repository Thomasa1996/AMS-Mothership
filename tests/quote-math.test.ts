import { describe, expect, it } from "vitest";
import { QuoteInput, lineAmountCents, lineDetail, parseDollarsToCents, quoteTotalCents } from "@/lib/quote-math";
import { fillPlaceholders, toListItems } from "@/lib/quote-template";

describe("quote math", () => {
  it("multiplies quantity by rate in cents, rounding half-cents", () => {
    expect(lineAmountCents(9750, 180)).toBe(1755000);
    expect(lineAmountCents(1.5, 333)).toBe(500);
  });

  it("totals the lines like the Leidos storage quote", () => {
    // Warehouse handling $16,201 + one month of storage (9,750 sq. ft. at $1.80) = $33,751
    expect(
      quoteTotalCents([
        { quantity: 1, rateCents: 1620100 },
        { quantity: 9750, rateCents: 180 },
      ]),
    ).toBe(3375100);
  });

  it("shows the note, or the math for quantity lines", () => {
    expect(lineDetail({ quantity: 1, unit: "flat", rateCents: 1626000, note: "includes 6 months of storage" })).toBe(
      "includes 6 months of storage",
    );
    expect(lineDetail({ quantity: 9750, unit: "sq. ft.", rateCents: 180 })).toBe("9,750 sq. ft. at $1.80 per sq. ft.");
    expect(lineDetail({ quantity: 1, unit: "each", rateCents: 500 })).toBeNull();
  });

  it("parses dollar inputs", () => {
    expect(parseDollarsToCents("$1,250.50")).toBe(125050);
    expect(parseDollarsToCents("")).toBe(0);
    expect(parseDollarsToCents("-3")).toBeNull();
  });
});

describe("quote input", () => {
  const base = {
    projectId: "p",
    title: "Relocation to MO",
    quoteDate: "2026-01-14",
    clientLabel: "JLL",
    serviceDescription: "Decommission services",
    intro: "Thanks",
    scopeTitle: "Primary Relocation/Installation",
    investmentHeading: "Investment",
    totalLabel: "Firm Fixed Project Total",
    valuation: "Valuation",
    companyDuties: "",
    clientDuties: "",
  };
  const line = { category: "Storage", description: "Storage", quantity: 1, unit: "flat", rateCents: 100 };

  it("requires at least one complete line", () => {
    expect(QuoteInput.safeParse({ ...base, lines: [] }).success).toBe(false);
    expect(QuoteInput.safeParse({ ...base, lines: [{ ...line, description: "" }] }).success).toBe(false);
    expect(QuoteInput.safeParse({ ...base, lines: [line] }).success).toBe(true);
  });

  it("stores the quote date at midnight UTC and blanks optional fields", () => {
    const q = QuoteInput.parse({ ...base, recipientName: "", lines: [line] });
    expect(q.quoteDate.toISOString()).toBe("2026-01-14T00:00:00.000Z");
    expect(q.recipientName).toBeNull();
  });
});

describe("quote template", () => {
  it("fills placeholders", () => {
    expect(fillPlaceholders("{company} for {service}", { company: "Apple Moving", service: "storage" })).toBe(
      "Apple Moving for storage",
    );
  });
  it("splits lists and strips pasted bullets", () => {
    expect(toListItems("• One\n- Two\n\n3. Three\nFour")).toEqual(["One", "Two", "Three", "Four"]);
  });
});
