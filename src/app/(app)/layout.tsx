import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { roleLabel } from "@/lib/constants";
import { logout } from "@/app/login/actions";
import { Logo } from "@/components/logo";
import { MainNav } from "@/components/main-nav";
import { Avatar } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <header className="bg-brand-900 text-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 overflow-hidden px-4 py-2.5">
          <Link href="/crm/accounts">
            <Logo />
          </Link>
          <MainNav />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-white/70 sm:inline">{user.company.name}</span>
            <Link href={user.role === "ADMIN" ? "/settings/users" : "/settings/profile"} className="text-white/70 hover:text-white">
              Settings
            </Link>
            <span className="flex items-center gap-2" title={roleLabel(user.role)}>
              <Avatar name={user.name} />
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
