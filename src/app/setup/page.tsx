import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Logo } from "@/components/logo";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await db.user.count()) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-900 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center text-white">
          <Logo size="lg" />
        </div>
        <div className="card p-6">
          <h1 className="mb-1 text-lg font-semibold">Set up Mothership</h1>
          <p className="mb-5 text-sm text-slate-500">
            Create your company and your admin login. Your 2026 standard rate card is loaded for you. Afterwards, upload your
            vendor file and branch profiles, and add your team under Settings.
          </p>
          <SetupForm />
        </div>
      </div>
    </main>
  );
}
