export function verificationTone(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s.startsWith("verified")) return "bg-emerald-100 text-emerald-800";
  if (s.startsWith("likely")) return "bg-lime-100 text-lime-800";
  if (s.startsWith("updated") || s.startsWith("contact added")) return "bg-sky-100 text-sky-800";
  if (s.startsWith("flag")) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

export function VerificationBadge({ status }: { status: string | null }) {
  if (!status) return null;
  return <span className={`badge whitespace-nowrap ${verificationTone(status)}`}>{status}</span>;
}
