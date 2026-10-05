import { describe, expect, it } from "vitest";
import { fillMonths, revenueQuery, rowsToMonths, tenantFromLink } from "@/lib/powerbi-api";

describe("Power BI revenue", () => {
  it("adds daily rows into months for each line", () => {
    const rows = [
      { "'Date'[Date]": "2025-01-03T00:00:00", "[S0]": 1000.4, "[S1]": 10 },
      { "'Date'[Date]": "2025-01-20T00:00:00", "[S0]": 500, "[S1]": null },
      { "'Date'[Date]": "2025-03-02T00:00:00", "[S0]": 250, "[S1]": 5 },
      { "'Date'[Date]": "2025-03-05T00:00:00", "[S0]": null, "[S1]": null },
    ];
    expect(rowsToMonths(rows, 2)).toEqual([
      [
        { year: 2025, month: 1, amount: 1500 },
        { year: 2025, month: 3, amount: 250 },
      ],
      [
        { year: 2025, month: 1, amount: 10 },
        { year: 2025, month: 3, amount: 5 },
      ],
    ]);
  });

  it("fills quiet months with zero through the current month", () => {
    const filled = fillMonths([{ year: 2025, month: 3, amount: 5 }], { year: 2026, month: 2 });
    expect(filled.length).toBe(14);
    expect(filled[0]).toEqual({ year: 2025, month: 1, amount: 0 });
    expect(filled[2]).toEqual({ year: 2025, month: 3, amount: 5 });
    expect(filled.at(-1)).toEqual({ year: 2026, month: 2, amount: 0 });
  });

  it("builds the DAX query", () => {
    const q = revenueQuery("'Date'[Date]", [{ name: "Commercial Revenue", amount: "[Commercial Revenue]" }, { name: "Actual Rev", amount: "[Actual Rev]" }], 2023);
    expect(q).toContain("SUMMARIZECOLUMNS(");
    expect(q).toContain("YEAR('Date'[Date]) >= 2023");
    expect(q).toContain('"S0", [Commercial Revenue],\n  "S1", [Actual Rev]\n)');
  });

  it("reads the tenant from a report link", () => {
    expect(tenantFromLink("https://app.powerbi.com/reportEmbed?reportId=1&ctid=8c3f2a1e-1111-2222-3333-444455556666")).toBe("8c3f2a1e-1111-2222-3333-444455556666");
    expect(tenantFromLink("https://app.powerbi.com/reportEmbed?reportId=1")).toBeNull();
  });
});
