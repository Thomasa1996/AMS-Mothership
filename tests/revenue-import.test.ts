import { describe, expect, it } from "vitest";
import { parsePastedRevenue, parseRevenueRows, yearMonthFrom } from "@/lib/revenue-import";

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

describe("pasted Power BI revenue table", () => {
  const text = [
    "Category\tMonth\tType\tSum of Amount",
    "Commercial Revenue\tJan\t\t",
    "Commercial Revenue\tJan\tActual Rev\t457,602",
    "Commercial Revenue\tFeb\tActual Rev\t293,344",
    "Commercial Revenue\tJan\tBudget\t0",
    "Commercial Revenue\tJan\tCorporate Account\t19,245",
    "Commercial Revenue\tOct\tCorporate Account\t(Blank)",
  ].join("\n");

  it("reads each type as its own line for the chosen year", () => {
    expect(parsePastedRevenue(text, 2026)).toEqual([
      { series: "Actual Rev", year: 2026, month: 1, amount: 457602 },
      { series: "Actual Rev", year: 2026, month: 2, amount: 293344 },
      { series: "Budget", year: 2026, month: 1, amount: 0 },
      { series: "Corporate Account", year: 2026, month: 1, amount: 19245 },
    ]);
  });

  it("needs a year when the table has none", () => {
    expect(() => parsePastedRevenue(text, null)).toThrow(/year/);
  });

  it("uses a Year column when there is one", () => {
    const csv = "Year,Month,Type,Amount\n2024,Jan,Actual Rev,308237\n2025,Jan,Actual Rev,249081";
    expect(parsePastedRevenue(csv, 2026).map((r) => r.year)).toEqual([2024, 2025]);
  });
});
