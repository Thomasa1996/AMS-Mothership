import { describe, expect, it } from "vitest";
import { parseRevenueRows, yearMonthFrom } from "@/lib/revenue-import";

describe("Power BI revenue export", () => {
  it("reads a date and amount table, adding rows in the same month", () => {
    const rows = [
      ["Revenue by month"],
      ["Close Date", "Account", "Revenue"],
      [new Date(Date.UTC(2025, 0, 15)), "Acme", "$1,000.50"],
      ["2025-01-20", "Beta", 2000],
      ["2/3/2025", "Acme", "(500)"],
      ["Total", "", 2500.5],
    ];
    expect(parseRevenueRows(rows)).toEqual([
      { year: 2025, month: 1, amount: 3001 },
      { year: 2025, month: 2, amount: -500 },
    ]);
  });

  it("reads Year and Month columns", () => {
    const rows = [["Year", "Month", "Sum of Amount"], [2025, "January", 100], [2026, "Jan", 150], ["2026", "February", "200"]];
    expect(parseRevenueRows(rows)).toEqual([
      { year: 2025, month: 1, amount: 100 },
      { year: 2026, month: 1, amount: 150 },
      { year: 2026, month: 2, amount: 200 },
    ]);
  });

  it("reads a matrix with months across", () => {
    const rows = [["Year", "January", "February", "March", "Total"], [2025, 10, 20, 30, 60], [2026, 15, "", 35, 50]];
    expect(parseRevenueRows(rows)).toEqual([
      { year: 2025, month: 1, amount: 10 },
      { year: 2025, month: 2, amount: 20 },
      { year: 2025, month: 3, amount: 30 },
      { year: 2026, month: 1, amount: 15 },
      { year: 2026, month: 3, amount: 35 },
    ]);
  });

  it("understands month labels", () => {
    expect(yearMonthFrom("January 2025")).toEqual([2025, 1]);
    expect(yearMonthFrom("Mar-26")).toEqual([2026, 3]);
    expect(yearMonthFrom("2025 Dec")).toEqual([2025, 12]);
  });

  it("explains a file it can't read", () => {
    expect(() => parseRevenueRows([["Name", "Notes"], ["a", "b"]])).toThrow(/date column/);
  });
});
