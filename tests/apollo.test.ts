import { describe, expect, it } from "vitest";
import { personToAccount, personToContact, splitList, toQuery } from "@/lib/apollo";

describe("Apollo", () => {
  it("writes array filters the way Apollo expects", () => {
    expect(decodeURIComponent(toQuery({ person_titles: ["Office Manager", "CFO"], q_keywords: undefined, page: 2 }))).toBe(
      "person_titles[]=Office+Manager&person_titles[]=CFO&page=2",
    );
  });

  it("splits comma-separated form fields", () => {
    expect(splitList(" Facilities Manager, ,Office Manager;CFO ")).toEqual(["Facilities Manager", "Office Manager", "CFO"]);
    expect(splitList(undefined)).toEqual([]);
  });

  it("maps a looked-up person to a contact and account", () => {
    const p = {
      id: "abc",
      first_name: "Tyrone",
      last_name: "Harris",
      name: "Tyrone Harris",
      title: "Facilities Manager",
      email: "THarris@Ataero.com",
      organization: { name: "Ataero", primary_domain: "ataero.com", sanitized_phone: "+17035550100", industry: "aviation & aerospace", raw_address: "Reston, VA" },
    };
    expect(personToContact(p)).toEqual({ name: "Tyrone Harris", title: "Facilities Manager", email: "tharris@ataero.com" });
    expect(personToAccount(p)).toEqual({ name: "Ataero", website: "https://ataero.com", phone: "+17035550100", industry: "Aviation & aerospace", address: "Reston, VA" });
  });

  it("drops Apollo's locked-email placeholder", () => {
    expect(personToContact({ id: "x", first_name: "A", last_name: "B", email: "email_not_unlocked@domain.com" }).email).toBeNull();
  });
});

describe("revenue filter", () => {
  it("reads money the way reps type it", async () => {
    const { parseMoney } = await import("@/lib/apollo");
    expect(parseMoney("$5M")).toBe(5_000_000);
    expect(parseMoney("2.5m")).toBe(2_500_000);
    expect(parseMoney("750k")).toBe(750_000);
    expect(parseMoney("1,000,000")).toBe(1_000_000);
    expect(parseMoney("")).toBeUndefined();
    expect(parseMoney("lots")).toBeUndefined();
  });
});
