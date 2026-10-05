import { gradeTone, type Grade } from "@/lib/vendor-grade";

export function GradeBadge({ grade, title }: { grade: Grade | null; title?: string }) {
  if (!grade) return <span className="text-xs text-slate-400">Not rated</span>;
  return (
    <span title={title} className={`badge inline-flex w-7 justify-center font-semibold ${gradeTone(grade)}`}>
      {grade}
    </span>
  );
}
