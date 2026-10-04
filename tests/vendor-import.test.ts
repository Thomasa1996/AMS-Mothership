import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { MISSING_COMPANY, cleanCategory, parseVendorWorkbook, rowsToVendors } from "@/lib/vendor-import";

const HEADER = ["Company", "State", "Contact Name", "Phone", "Email", "Apollo Verification Status", "Notes"];

describe("rowsToVendors", () => {
  it("maps columns by header name", () => {
    const [v] = rowsToVendors("OMA", [HEADER, ["Acme Movers", "VA", "Jo Smith", "555-1000", "jo@acme.example", "Verified - still with vendor", null]]);
    expect(v).toMatchObject({
      category: "OMA",
      name: "Acme Movers",
      state: "VA",
      contactName: "Jo Smith",
      verificationStatus: "Verified - still with vendor",
      notes: null,
    });
  });

  it("carries the company down only for another contact at the same email domain", () => {
    const rows = rowsToVendors("CRN", [
      HEADER,
      ["Acme Movers", "VA", "Jo Smith", null, "jo@acme.example"],
      [null, null, "Second Contact", null, "second@acme.example"],
      [null, null, "Stranger", null, "someone@other.example"],
      [null, null, null, "555-0000"],
    ]);
    expect(rows.map((r) => [r.name, r.contactName, r.position])).toEqual([
      ["Acme Movers", "Jo Smith", 0],
      ["Acme Movers", "Second Contact", 1],
      [MISSING_COMPANY, "Stranger", 2],
      [MISSING_COMPANY, null, 3],
    ]);
  });

  it("skips empty rows, cleans non-breaking spaces and reads CMG headers", () => {
    const rows = rowsToVendors("CMG Directory", [
      ["Member ID", "Company Name", "CMG Contact", "Markets"],
      [null, null, null, null],
      ["R101", "RS MOVING", " Lauren ", "MOBILE"],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ memberId: "R101", name: "RS MOVING", contactName: "Lauren", markets: "MOBILE" });
  });

  it("ignores sheets without a company column", () => {
    expect(rowsToVendors("Misc", [["Foo", "Bar"], ["a", "b"]])).toEqual([]);
  });
});

describe("cleanCategory", () => {
  it("trims and collapses spaces in sheet names", () => {
    expect(cleanCategory("Equipment  Forklift Rentals ")).toBe("Equipment Forklift Rentals");
  });
});

describe("parseVendorWorkbook", () => {
  it("reads every sheet as a category", async () => {
    const wb = new ExcelJS.Workbook();
    const a = wb.addWorksheet("Crane Rentals ");
    a.addRow(HEADER);
    a.addRow(["Big Lift Co", "MD", "Sam", "555-2000", { text: "sam@biglift.example", hyperlink: "mailto:sam@biglift.example" }]);
    const b = wb.addWorksheet("Couriers");
    b.addRow(HEADER);
    b.addRow(["Fast Courier", "DC"]);
    const buffer = await wb.xlsx.writeBuffer();
    const rows = await parseVendorWorkbook(buffer as ArrayBuffer);
    expect(rows.map((r) => [r.category, r.name, r.email])).toEqual([
      ["Crane Rentals", "Big Lift Co", "sam@biglift.example"],
      ["Couriers", "Fast Courier", null],
    ]);
  });
});
