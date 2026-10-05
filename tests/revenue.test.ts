import { describe, expect, it } from "vitest";
import { change, parseDollars, yearToDate } from "@/lib/revenue";
import { closedAtFor } from "@/lib/constants";

describe("revenue", () => {
  it("compares years through the same month", () => {
    const prev = [100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0];
    const cur = [150, 50, 200, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(yearToDate(prev, cur, 3)).toEqual({ before: 300, after: 400, amount: 100, percent: (100 / 300) * 100 });
    expect(change(0, 500).percent).toBeNull();
  });

  it("reads typed dollar amounts", () => {
    expect(parseDollars("$12,500.00")).toBe(12500);
    expect(parseDollars("12.5k")).toBe(12500);
    expect(parseDollars(" ")).toBeNull();
    expect(parseDollars("abc")).toBeNaN();
  });

  it("stamps the won date when a project is booked", () => {
    expect(closedAtFor("QUOTED", "BOOKED", null).closedAt).toBeInstanceOf(Date);
    expect(closedAtFor("BOOKED", "COMPLETED", null)).toEqual({});
    expect(closedAtFor("QUOTED", "BOOKED", new Date(0))).toEqual({});
    expect(closedAtFor("BOOKED", "LOST", new Date(0))).toEqual({ closedAt: null });
  });
});
