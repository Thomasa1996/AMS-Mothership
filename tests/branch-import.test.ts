import { describe, expect, it } from "vitest";
import { factValues, sheetToBranch } from "@/lib/branch-import";

const grid = (rows: (string | null)[][]) => rows;

describe("branch profile import", () => {
  it("reads one warehouse, contacts and sections", () => {
    const b = sheetToBranch(
      "Augusta ",
      grid([
        ["Apple Moving Warehouse Profile", "Date: 09/16/2024", "PJ Approved"],
        [],
        ["Warehouse Address", "618 Sandbarferry rd"],
        ["Warehouse City, State, Zip", "Augusta, GA"],
        [],
        ["Contacts Name", "Title ", "Phone ", "Email"],
        ["Nic Bowman", "General Manager", "7066916289", "nbowman@example.com"],
        [null, "Warehouse Manager"],
        [],
        ["Warehouse Overview"],
        ["Total Square Feet", "35000"],
        ["Labor Overview"],
        ["# of Crews", "5"],
      ]),
      0,
    );
    expect(b.name).toBe("Augusta");
    expect(b.profileDate).toBe("09/16/2024");
    expect(b.warehouses).toEqual([{ address: "618 Sandbarferry rd", cityStateZip: "Augusta, GA" }]);
    expect(b.contacts).toEqual([{ name: "Nic Bowman", title: "General Manager", phone: "7066916289", email: "nbowman@example.com" }]);
    expect(factValues(b.profile, "Total Square Feet")).toEqual(["35000"]);
    expect(factValues(b.profile, "# of crews")).toEqual(["5"]);
  });

  it("reads several warehouses side by side", () => {
    const b = sheetToBranch(
      "El Paso",
      grid([
        ["Apple Moving Warehouse Profile", "Date: 9/13/24"],
        [null, "Warehouse 1", "Warehouse 2"],
        ["Warehouse Address", "10823 Pellicano Dr", "1111 Vista DeOro"],
        ["Warehouse City, State, Zip", "El Paso, TX 79935", "El Paso, TX"],
        ["Warehouse Overview", "1", "2"],
        ["Total Square Feet", "40000", "20000"],
      ]),
      0,
    );
    expect(b.warehouses).toHaveLength(2);
    expect(factValues(b.profile, "Total Square Feet")).toEqual(["40000", "20000"]);
  });

  it("fills gaps from the older Contact Info block on the right", () => {
    const row = (a: (string | null)[], side: (string | null)[]) => [...a, ...Array(5 - a.length).fill(null), ...side];
    const b = sheetToBranch(
      "Austin",
      grid([
        row(["Apple Moving Warehouse Profile", "Date:"], ["Contact Info"]),
        row(["Warehouse Address"], ["General Manager", "Jon Anderson", "817-575-9849", "jon@example.com"]),
        row(["Contacts Name", "Title ", "Phone ", "Email"], []),
        row([null, "General Manager"], ["Scale on property", "Yes"]),
        row([], []),
        row(["Equipment / Performance Overview"], ["Racking", "Yes"]),
        row(["Scale on Property"], []),
      ]),
      0,
    );
    expect(b.contacts).toEqual([{ name: "Jon Anderson", title: "General Manager", phone: "817-575-9849", email: "jon@example.com" }]);
    expect(factValues(b.profile, "Scale on Property")).toEqual(["Yes"]);
    expect(factValues(b.profile, "Racking")).toEqual(["Yes"]);
  });
});
