import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { signSession, verifySession } from "@/lib/session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-that-is-long-enough";
});

describe("session tokens", () => {
  it("round-trips the user, company and role", async () => {
    const token = await signSession({ userId: "u1", companyId: "c1", role: "ADMIN" });
    expect(await verifySession(token)).toEqual({ userId: "u1", companyId: "c1", role: "ADMIN" });
  });
  it("rejects missing, tampered and foreign-signed tokens", async () => {
    expect(await verifySession(undefined)).toBeNull();
    const token = await signSession({ userId: "u1", companyId: "c1", role: "SALES" });
    expect(await verifySession(token.slice(0, -2) + "xx")).toBeNull();
    const foreign = await new SignJWT({ userId: "u1", companyId: "c1", role: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode("some-other-secret-value"));
    expect(await verifySession(foreign)).toBeNull();
  });
});
