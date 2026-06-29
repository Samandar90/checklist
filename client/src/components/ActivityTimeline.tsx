import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuditLog } from "@/types";

const ACTION_META = {
  CREATE: { icon: Plus, className: "bg-emerald-500/10 text-emerald-600" },
  UPDATE: { icon: Pencil, className: "bg-amber-500/10 text-amber-600" },
  DELETE: { icon: Trash2, className: "bg-rose-500/10 text-rose-600" },
} as const;

export default function ActivityTimeline({ items, emptyText }: { items: AuditLog[]; emptyText?: string }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText ?? "Пока нет активности"}</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {items.map((log) => {
        const meta = ACTION_META[log.action];
        const Icon = meta.icon;
        return (
          <li key={log.id} className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary">
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", meta.className)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-foreground">{log.summary}</p>
              <p className="text-[11px] text-muted-foreground">
                {log.actorName} · {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: ru })}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
