import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session";

// Set when an admin previews the app as a sales rep (Settings, My profile). Only changes what that
// admin sees and can do; nobody else is affected.
export const PREVIEW_COOKIE = "mothership_preview";

export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { company: true },
    // Pictures are served by their own routes; no need to load them on every request.
    omit: { photo: true, background: true },
  });
  if (!user || !user.active || user.companyId !== session.companyId) return null;
  if (user.role === "ADMIN" && store.get(PREVIEW_COOKIE)?.value === "SALES") return { ...user, role: "SALES", previewing: true };
  return { ...user, previewing: false };
});

// Use in every page and action that touches company data.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function startSession(user: { id: string; companyId: string; role: string }) {
  const token = await signSession({ userId: user.id, companyId: user.companyId, role: user.role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  store.delete(PREVIEW_COOKIE);
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(PREVIEW_COOKIE);
}
