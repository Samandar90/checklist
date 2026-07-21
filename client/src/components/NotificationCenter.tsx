import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Search, CheckCheck, Archive, ArchiveRestore, Inbox, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

import { useReports } from "@/hooks/useReports";
import { useRooms } from "@/hooks/useRooms";
import { useHousekeeping } from "@/hooks/useHousekeeping";
import { useNotificationState } from "@/hooks/useNotificationState";
import { cn } from "@/lib/utils";
import { buildNotifications, CATEGORY_META, NotificationCategory } from "@/lib/notifications";

type Tab = "all" | "unread" | "archived";

const CATEGORY_ORDER: NotificationCategory[] = ["ARRIVAL", "DEPARTURE", "OVERDUE", "CLEANING", "CONFLICT", "MAINTENANCE"];

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<NotificationCategory>>(new Set(CATEGORY_ORDER));
  const ref = useRef<HTMLDivElement>(null);

  // Уведомления — про сегодня (заезды/выезды/долги/конфликты), поэтому берём
  // текущий год, а не всю историю: этот запрос идёт на каждой странице.
  // Полный список задолженностей всегда доступен на странице «Должники».
  const { data: reports } = useReports({ year: String(new Date().getFullYear()) });
  const { data: rooms } = useRooms();
  const hk = useHousekeeping();
  const state = useNotificationState();

  const all = useMemo(() => {
    if (!reports || !rooms) return [];
    const hkByRoom: Record<string, ReturnType<typeof hk.get>> = {};
    for (const room of rooms) hkByRoom[room.id] = hk.get(room.id);
    return buildNotifications(reports, rooms, hkByRoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, rooms]);

  const unreadCount = all.filter((n) => !state.isArchived(n.id) && !state.isRead(n.id)).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((n) => {
      if (!activeCategories.has(n.category)) return false;
      if (tab === "archived" && !state.isArchived(n.id)) return false;
      if (tab !== "archived" && state.isArchived(n.id)) return false;
      if (tab === "unread" && state.isRead(n.id)) return false;
      if (q && !`${n.title} ${n.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, activeCategories, tab, search, state.read, state.archived]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  function toggleCategory(cat: NotificationCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next.size === 0 ? new Set(CATEGORY_ORDER) : next;
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Уведомления"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Bell className="h-[16px] w-[16px]" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9.5px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="glass-strong absolute right-0 top-[calc(100%+6px)] z-30 w-[420px] overflow-hidden rounded-2xl"
          >
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-semibold text-foreground">Уведомления</p>
                {unreadCount > 0 && (
                  <button
                    onClick={() => state.markAllRead(filtered.map((n) => n.id))}
                    className="flex items-center gap-1 text-[11.5px] font-medium text-primary hover:opacity-80"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Прочитать все
                  </button>
                )}
              </div>

              <div className="mt-2.5 flex gap-1 rounded-full bg-secondary/60 p-1">
                {([
                  ["all", "Все"],
                  ["unread", "Непрочитанные"],
                  ["archived", "Архив"],
                ] as [Tab, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={cn(
                      "flex-1 rounded-full px-2 py-1 text-[12px] font-medium transition-all",
                      tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative mt-2.5">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по уведомлениям…"
                  className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-7 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {CATEGORY_ORDER.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const active = activeCategories.has(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                        active ? meta.tint : "bg-secondary text-muted-foreground"
                      )}
                    >
                      <meta.icon className="h-2.5 w-2.5" /> {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Inbox className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {tab === "archived" ? "В архиве пусто" : "Нет уведомлений"}
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {filtered.map((n) => {
                    const meta = CATEGORY_META[n.category];
                    const unread = !state.isRead(n.id);
                    return (
                      <motion.div
                        key={n.id}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.18 }}
                        onMouseEnter={() => unread && state.markRead(n.id)}
                        className={cn("group relative flex gap-2.5 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-secondary", unread && "bg-primary/[0.04]")}
                      >
                        <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", meta.tint)}>
                          <meta.icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                            <p className="truncate text-[13px] font-medium text-foreground">{n.title}</p>
                          </div>
                          <p className="truncate text-[12px] text-muted-foreground">{n.description}</p>
                          <p className="mt-0.5 text-[10.5px] text-muted-foreground/70">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ru })}
                          </p>
                        </div>
                        <button
                          onClick={() => (state.isArchived(n.id) ? state.unarchive(n.id) : state.archive(n.id))}
                          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-card hover:text-foreground group-hover:opacity-100"
                          aria-label={state.isArchived(n.id) ? "Вернуть из архива" : "Архивировать"}
                        >
                          {state.isArchived(n.id) ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
