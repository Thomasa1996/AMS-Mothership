import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 to-brand-700 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center text-white">
          <Logo size="lg" />
        </div>
        <div className="card p-6">
          <h1 className="mb-1 text-lg font-semibold">Sign in</h1>
          <p className="mb-5 text-sm text-slate-500">Relocation Shephard Software</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
