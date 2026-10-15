import { describe, expect, it } from "vitest";
import { accountKey, domainOf, findAccount } from "@/lib/proposal-account";

const a = (id: string, name: string, website: string | null = null, emails: string[] = []) => ({ id, name, website, emails });
const accounts = [
  a("mhp", "Meridian Health Partners, LLC", "https://www.meridianhealth.com"),
  a("mer", "Meridian"),
  a("fort", "Fort Hood Credit Union", null, ["pat@fhcu.org"]),
  a("co", "The Company"),
];

describe("accountKey and domainOf", () => {
  it("drops filler words and refuses names too vague to trust", () => {
    expect(accountKey("Meridian Health Partners, LLC")).toBe("meridian health partners");
    expect(accountKey("The Company")).toBe("");
    expect(accountKey("ABC Inc")).toBe("");
  });
  it("reads domains from links and emails", () => {
    expect(domainOf("https://www.meridianhealth.com/about")).toBe("meridianhealth.com");
    expect(domainOf("JW@MeridianHealth.com")).toBe("meridianhealth.com");
  });
});

describe("findAccount", () => {
  it("prefers the email the quote was sent to", () => {
    expect(findAccount({ to: ["someone@fhcu.org"], text: "Prepared for Meridian Health Partners" }, accounts)?.id).toBe("fort");
  });
  it("uses an address written in the file, but not our own", () => {
    const text = "Contact: tom@applemoving.com. Client: jwhitfield@meridianhealth.com";
    expect(findAccount({ text }, accounts, ["applemoving.com"])?.id).toBe("mhp");
  });
  it("falls back to the name mentioned most, longest name on a tie", () => {
    expect(findAccount({ text: "Office move for Meridian Health Partners at their Meridian campus" }, accounts)?.id).toBe("mhp");
    expect(findAccount({ text: "Fort Hood Credit Union branch relocation" }, accounts)?.id).toBe("fort");
  });
  it("returns null when nothing matches", () => {
    expect(findAccount({ to: ["x@gmail.com"], text: "A move for the company" }, accounts)).toBeNull();
  });
});
