import { describe, expect, it } from "vitest";
import { accountScope, limitedToOwn, ownerChoices, projectScope, quoteScope } from "@/lib/access";

const admin = { id: "u-admin", companyId: "c1", role: "ADMIN" };
const rep = { id: "u-rep", companyId: "c1", role: "SALES" };
const pm = { id: "u-pm", companyId: "c1", role: "PROJECT_MANAGER" };

describe("access scopes", () => {
  it("limits only salespeople", () => {
    expect(limitedToOwn(rep)).toBe(true);
    expect(limitedToOwn(admin)).toBe(false);
    expect(limitedToOwn(pm)).toBe(false);
  });

  it("gives admins the whole company", () => {
    expect(accountScope(admin)).toEqual({ companyId: "c1" });
    expect(projectScope(admin)).toEqual({ companyId: "c1" });
    expect(quoteScope(admin)).toEqual({ companyId: "c1" });
    expect(ownerChoices(admin)).toEqual({ companyId: "c1" });
  });

  it("gives salespeople their own accounts, those accounts' projects, and their quotes", () => {
    expect(accountScope(rep)).toEqual({ companyId: "c1", ownerId: "u-rep" });
    expect(projectScope(rep)).toEqual({ companyId: "c1", account: { ownerId: "u-rep" } });
    expect(quoteScope(rep)).toEqual({
      companyId: "c1",
      OR: [{ createdById: "u-rep" }, { project: { account: { ownerId: "u-rep" } } }],
    });
    expect(ownerChoices(rep)).toEqual({ companyId: "c1", id: "u-rep" });
  });
});
