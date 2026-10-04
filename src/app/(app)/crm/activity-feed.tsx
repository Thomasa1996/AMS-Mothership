import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui";

const TYPE_LABEL: Record<string, string> = {
  NOTE: "Note",
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  STAGE_CHANGE: "Update",
};

type Item = {
  id: string;
  type: string;
  body: string;
  createdAt: Date;
  user: { name: string };
  project?: { name: string } | null;
};

export function ActivityFeed({ items, showProject = false }: { items: Item[]; showProject?: boolean }) {
  if (items.length === 0) return <EmptyState>No activity yet.</EmptyState>;
  return (
    <ol className="space-y-4">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.type === "STAGE_CHANGE" ? "bg-slate-300" : "bg-brand-500"}`}
          />
          <div className="min-w-0">
            <div className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{TYPE_LABEL[a.type] ?? a.type}</span> by {a.user.name} ·{" "}
              {formatDateTime(a.createdAt)}
              {showProject && a.project && <> · {a.project.name}</>}
            </div>
            <p className={`whitespace-pre-wrap text-sm ${a.type === "STAGE_CHANGE" ? "text-slate-500" : ""}`}>{a.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
