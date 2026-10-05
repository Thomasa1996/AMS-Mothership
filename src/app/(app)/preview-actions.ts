"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_COOKIE, requireUser } from "@/lib/auth";

// An admin sees and uses the app exactly as a sales rep would, with their own accounts, until they exit.
export async function startRepPreview() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only admins can preview");
  const store = await cookies();
  store.set(PREVIEW_COOKIE, "SALES", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  redirect("/crm/accounts");
}

export async function endRepPreview() {
  const store = await cookies();
  store.delete(PREVIEW_COOKIE);
  redirect("/settings/profile");
}
