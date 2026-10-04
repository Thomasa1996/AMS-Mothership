import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main
      className="relative flex min-h-screen items-end justify-center bg-brand-900 bg-cover bg-center px-4 py-10 md:items-center md:justify-end md:px-8"
      style={{ backgroundImage: "url(/mothership-hero.jpg)" }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent md:bg-gradient-to-l md:from-slate-950/70" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 hidden justify-center text-white drop-shadow md:flex">
          <Logo size="lg" />
        </div>
        <div className="card p-6">
          <h1 className="mb-1 text-lg font-semibold">Sign in</h1>
          <p className="mb-5 text-sm text-slate-500">Mothership · Relocation Shephard Software</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
