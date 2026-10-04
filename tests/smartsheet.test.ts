import { describe, expect, it } from "vitest";
import { cellText, sheetTable, type Sheet } from "@/lib/smartsheet";
import { parseSheetIds, sheetVisible } from "@/lib/smartsheet-company";

const sheet: Sheet = {
  id: 1,
  name: "Leidos move",
  columns: [
    { id: 11, index: 1, title: "Status", type: "PICKLIST" },
    { id: 10, index: 0, title: "Task", type: "TEXT_NUMBER", primary: true },
    { id: 12, index: 2, title: "Done", type: "CHECKBOX" },
    { id: 13, index: 3, title: "Internal", type: "TEXT_NUMBER", hidden: true },
  ],
  rows: [
    { id: 100, rowNumber: 1, cells: [{ columnId: 10, value: "Phase 1", displayValue: "Phase 1" }, { columnId: 12, value: true }] },
    { id: 101, rowNumber: 2, parentId: 100, cells: [{ columnId: 10, value: "Pack IT" }, { columnId: 11, value: "Open" }, { columnId: 13, value: "x" }] },
    { id: 102, rowNumber: 3, parentId: 101, cells: [{ columnId: 10, value: 42 }] },
  ],
};

describe("sheetTable", () => {
  it("orders visible columns, indents child rows and renders cells as text", () => {
    const t = sheetTable(sheet);
    expect(t.columns).toEqual([
      { title: "Task", primary: true },
      { title: "Status", primary: false },
      { title: "Done", primary: false },
    ]);
    expect(t.rows.map((r) => r.depth)).toEqual([0, 1, 2]);
    expect(t.rows[0]!.cells).toEqual(["Phase 1", "", "✓"]);
    expect(t.rows[1]!.cells).toEqual(["Pack IT", "Open", ""]);
    expect(t.rows[2]!.cells).toEqual(["42", "", ""]);
  });

  it("prefers the display value", () => {
    expect(cellText({ columnId: 1, value: "2026-10-04", displayValue: "10/04/26" }, "DATE")).toBe("10/04/26");
    expect(cellText(undefined, "TEXT_NUMBER")).toBe("");
  });
});

describe("sheet choice", () => {
  it("shows every sheet when none are chosen", () => {
    expect(sheetVisible([], 5)).toBe(true);
    expect(sheetVisible(["5"], 5)).toBe(true);
    expect(sheetVisible(["5"], 6)).toBe(false);
    expect(parseSheetIds("not json")).toEqual([]);
    expect(parseSheetIds('["1",2]')).toEqual(["1", "2"]);
  });
});
