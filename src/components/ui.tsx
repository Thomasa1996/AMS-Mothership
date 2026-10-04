import { stageLabel } from "@/lib/constants";
import { initials } from "@/lib/format";

const STAGE_COLORS: Record<string, string> = {
  LEAD: "bg-slate-100 text-slate-700",
  SURVEY: "bg-amber-100 text-amber-800",
  QUOTED: "bg-violet-100 text-violet-800",
  BOOKED: "bg-sky-100 text-sky-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  LOST: "bg-rose-100 text-rose-700",
};

export function StageBadge({ stage }: { stage: string }) {
  return <span className={`badge ${STAGE_COLORS[stage] ?? "bg-slate-100"}`}>{stageLabel(stage)}</span>;
}

export function Avatar({ name, photoUrl, size = "sm" }: { name: string; photoUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "h-6 w-6 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-16 w-16 text-lg" }[size];
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={name} title={name} className={`inline-block shrink-0 rounded-full object-cover ${box}`} />;
  }
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 ${box}`}
    >
      {initials(name)}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-500">{children}</div>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm">{children || <span className="text-slate-400">None</span>}</dd>
    </div>
  );
}

export function ComingSoon({ title, phase, items }: { title: string; phase: number; items: string[] }) {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={title} subtitle={`Arrives in Phase ${phase} of the roadmap`} />
      <div className="card p-6">
        <p className="mb-3 text-sm text-slate-600">This tab will include:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
