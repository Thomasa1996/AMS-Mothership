import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { roleLabel } from "@/lib/constants";
import { logout } from "@/app/login/actions";
import { Logo } from "@/components/logo";
import { backgroundUrl, photoUrl } from "@/lib/photos";
import { MainNav } from "@/components/main-nav";
import { Avatar } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const background = backgroundUrl(user);
  return (
    <div className="min-h-screen">
      {background && (
        // The person's own picture behind everything, dimmed so page text stays readable.
        <div className="fixed inset-0 -z-10 bg-cover bg-center print:hidden" style={{ backgroundImage: `url(${background})` }}>
          <div className="absolute inset-0 bg-slate-50/75" />
        </div>
      )}
      <header className="bg-brand-900 text-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 overflow-hidden px-4 py-2.5">
          <Link href="/crm/accounts">
            <Logo />
          </Link>
          <MainNav />
          <div className="ml-auto flex items-center gap-3 text-sm">
            {/* The quote template logo when one is uploaded, else the bundled Apple Moving logo. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.company.logo ?? "/company-logo.png"}
              alt={user.company.name}
              title={user.company.name}
              className="hidden h-8 max-w-32 rounded bg-white object-contain px-1.5 py-0.5 sm:block"
            />
            <Link href={user.role === "ADMIN" ? "/settings/users" : "/settings/profile"} className="text-white/70 hover:text-white">
              Settings
            </Link>
            <span className="flex items-center gap-2" title={roleLabel(user.role)}>
              <Avatar name={user.name} photoUrl={photoUrl(user)} />
              <span className="hidden md:inline">{user.name}</span>
            </span>
            <form action={logout}>
              <button className="text-white/70 hover:text-white">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
