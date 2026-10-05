import { describe, expect, it } from "vitest";
import { dateFrom, dollarsFrom, findPerson, guessColumns, stageFromText } from "@/lib/smartsheet-import";

describe("Smartsheet project import", () => {
  it("guesses columns from common titles", () => {
    const cols = [
      { id: "1", title: "Job Name" },
      { id: "2", title: "Client" },
      { id: "3", title: "Sales Rep" },
      { id: "4", title: "Move Date" },
      { id: "5", title: "Status" },
      { id: "6", title: "Contract Value" },
    ];
    expect(guessColumns(cols)).toEqual({ name: "1", company: "2", owner: "3", moveDate: "4", stage: "5", value: "6" });
  });

  it("reads statuses", () => {
    expect(stageFromText("Complete")).toBe("COMPLETED");
    expect(stageFromText("In Progress")).toBe("IN_PROGRESS");
    expect(stageFromText("Cancelled")).toBe("LOST");
    expect(stageFromText("Quote sent")).toBe("QUOTED");
    expect(stageFromText("Scheduled")).toBe("BOOKED");
    expect(stageFromText("")).toBe("BOOKED");
  });

  it("reads money and dates", () => {
    expect(dollarsFrom("$12,500.40")).toBe(12500);
    expect(dollarsFrom(8000)).toBe(8000);
    expect(dollarsFrom("TBD")).toBeNull();
    expect(dateFrom("2026-10-05")?.toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(dateFrom("10/5/26")?.toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(dateFrom("next week")).toBeNull();
  });

  it("matches reps by email or name", () => {
    const people = [{ id: "u1", name: "Sarah Kim", email: "sarah@x.com" }];
    expect(findPerson(people, { value: "sarah@x.com", displayValue: "Sarah K" })?.id).toBe("u1");
    expect(findPerson(people, { value: "sarah kim" })?.id).toBe("u1");
    expect(findPerson(people, { value: "Robert Mendez" })).toBeNull();
  });
});
