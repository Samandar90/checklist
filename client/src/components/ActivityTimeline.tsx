import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuditLog } from "@/types";

const ACTION_META = {
  CREATE: { icon: Plus,   tint: "tint-emerald" },
  UPDATE: { icon: Pencil, tint: "tint-amber" },
  DELETE: { icon: Trash2, tint: "tint-rose" },
} as const;

export default function ActivityTimeline({ items, emptyText }: { items: AuditLog[]; emptyText?: string }) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyText ?? "Пока нет активности"}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((log) => {
        const meta = ACTION_META[log.action as keyof typeof ACTION_META] ?? ACTION_META.UPDATE;
        const Icon = meta.icon;
        return (
          <li
            key={log.id}
            className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary"
          >
            <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", meta.tint)}>
              <Icon className="h-3 w-3" />
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
