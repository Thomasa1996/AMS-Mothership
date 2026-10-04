import { describe, expect, it } from "vitest";
import { AccountSchema, ContactSchema, ProjectSchema, moneyField, dateField } from "@/lib/validation";

describe("moneyField", () => {
  it("accepts plain and formatted dollar amounts", () => {
    expect(moneyField.parse("12000")).toBe(12000);
    expect(moneyField.parse("$12,000")).toBe(12000);
    expect(moneyField.parse("1,250.60")).toBe(1251);
  });
  it("treats blank as empty", () => {
    expect(moneyField.parse("")).toBeNull();
    expect(moneyField.parse(undefined)).toBeNull();
  });
  it("rejects text and negatives", () => {
    expect(moneyField.safeParse("abc").success).toBe(false);
    expect(moneyField.safeParse("-5").success).toBe(false);
  });
});

describe("dateField", () => {
  it("stores dates at midnight UTC", () => {
    expect(dateField.parse("2026-11-03")?.toISOString()).toBe("2026-11-03T00:00:00.000Z");
  });
  it("rejects malformed dates", () => {
    expect(dateField.safeParse("11/03/2026").success).toBe(false);
  });
});

describe("AccountSchema", () => {
  it("requires a name and blanks optional fields", () => {
    expect(AccountSchema.safeParse({ name: "  " }).success).toBe(false);
    const parsed = AccountSchema.parse({ name: " Acme ", phone: "", ownerId: "" });
    expect(parsed).toMatchObject({ name: "Acme", phone: null, ownerId: null, source: "MANUAL" });
  });
});

describe("ContactSchema", () => {
  it("validates email and reads the primary checkbox", () => {
    expect(ContactSchema.safeParse({ name: "Pat", email: "nope" }).success).toBe(false);
    expect(ContactSchema.parse({ name: "Pat", email: "Pat@Example.com", isPrimary: "on" })).toMatchObject({
      email: "pat@example.com",
      isPrimary: true,
    });
  });
});

describe("ProjectSchema", () => {
  it("rejects unknown stages", () => {
    expect(ProjectSchema.safeParse({ accountId: "a", name: "Move", stage: "MAYBE" }).success).toBe(false);
  });
  it("defaults the stage to Lead", () => {
    expect(ProjectSchema.parse({ accountId: "a", name: "Move" }).stage).toBe("LEAD");
  });
});
