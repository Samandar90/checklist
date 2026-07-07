import { useMemo } from "react";
import { Pencil, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Expense } from "@/types";
import { cn, formatMoney } from "@/lib/utils";

/**
 * Расходы, сгруппированные по дням: заголовок дня с общей суммой,
 * внутри — записи в порядке времени добавления (createdAt по возрастанию).
 */
export default function ExpenseDayList({
  expenses,
  showBranch = false,
  showSpender = false,
  onEdit,
  onDelete,
}: {
  expenses: Expense[];
  showBranch?: boolean;
  showSpender?: boolean;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}) {
  const groups = useMemo(() => {
    const byDay = new Map<string, Expense[]>();
    for (const e of expenses) {
      const key = e.date.slice(0, 10);
      const list = byDay.get(key);
      if (list) list.push(e);
      else byDay.set(key, [e]);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0])) // дни — от новых к старым
      .map(([day, items]) => ({
        day,
        // внутри дня — в порядке добавления (по времени)
        items: items.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        totals: sumByCurrency(items),
      }));
  }, [expenses]);

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.day} className="overflow-hidden rounded-xl border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm font-semibold capitalize text-foreground">{dayLabel(g.day)}</h3>
              <span className="text-xs text-muted-foreground">
                {g.items.length} {plural(g.items.length, "запись", "записи", "записей")}
              </span>
            </div>
            <div className="text-sm font-semibold tabular-nums text-foreground">
              {g.totals.map(({ currency, total }) => formatMoney(total, currency)).join(" + ")}
            </div>
          </header>

          <ul className="divide-y divide-border">
            {g.items.map((e) => (
              <li key={e.id} className="group flex items-center gap-3 px-4 py-2.5">
                <span className="flex w-14 shrink-0 items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {timeLabel(e.createdAt)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{e.category}</span>
                    {showBranch && <span className="text-xs text-muted-foreground">· {e.branch.name}</span>}
                    {showSpender && (
                      <span className="text-xs text-muted-foreground">· {e.admin?.fullName ?? "Главный аккаунт"}</span>
                    )}
                  </div>
                  {e.note && <p className="truncate text-xs text-muted-foreground">{e.note}</p>}
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatMoney(e.amount, e.currency)}
                </span>
                <div
                  className={cn(
                    "flex shrink-0 gap-0.5 opacity-0 transition-opacity",
                    "group-hover:opacity-100 focus-within:opacity-100"
                  )}
                >
                  <Button variant="ghost" size="icon" onClick={() => onEdit(e)} aria-label="Редактировать">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(e)} aria-label="Удалить">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function sumByCurrency(items: Expense[]) {
  const map = new Map<string, number>();
  for (const e of items) map.set(e.currency, (map.get(e.currency) ?? 0) + e.amount);
  return [...map.entries()].map(([currency, total]) => ({ currency, total }));
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(day: string) {
  const d = new Date(`${day}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  const base = d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  if (diff === 0) return `Сегодня, ${base}`;
  if (diff === 1) return `Вчера, ${base}`;
  return base;
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
