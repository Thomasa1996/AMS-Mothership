import { SignJWT, jwtVerify } from "jose";

// Signed session token stored in an http-only cookie. Kept free of Next.js imports so it can be unit tested.

export const SESSION_COOKIE = "mothership_session";
const SESSION_DAYS = 14;

export type SessionPayload = { userId: string; companyId: string; role: string };

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET must be set to at least 16 characters");
  if (process.env.NODE_ENV === "production" && secret.startsWith("change-me")) {
    throw new Error("SESSION_SECRET is still the example value; set a long random string");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || typeof payload.companyId !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return { userId: payload.userId, companyId: payload.companyId, role: payload.role };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
