import { quoteStatusLabel } from "@/lib/quote-math";

const TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-sky-100 text-sky-800",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  DECLINED: "bg-rose-100 text-rose-700",
};

export function QuoteStatusBadge({ status }: { status: string }) {
  return <span className={`badge ${TONE[status] ?? "bg-slate-100"}`}>{quoteStatusLabel(status)}</span>;
}
