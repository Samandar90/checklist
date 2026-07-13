import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, Star, Clock, Zap, CornerDownLeft, X, ChevronLeft, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_NAV_ITEMS, getQuickActions } from "@/lib/nav";
import { useAuth } from "@/contexts/AuthContext";
import { useReports, useUpdateReportStatus } from "@/hooks/useReports";
import { useRooms } from "@/hooks/useRooms";
import { useBranches } from "@/hooks/useBranches";
import { useAdmins } from "@/hooks/useAdmins";
import { useExpenses } from "@/hooks/useExpenses";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { buildSearchIndex, searchIndex, ENTITY_META } from "@/lib/globalSearch";
import { getErrorMessage } from "@/lib/api";

type Mode = "default" | "checkin" | "checkout";

interface PaletteEntry {
  key: string;
  label: string;
  subtitle?: string;
  icon: typeof Search;
  group: string;
  action: () => void;
}

export default function CommandPalette({
  open,
  onOpenChange,
  favorites,
  recent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  favorites: string[];
  recent: string[];
}) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("default");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const { recentSearches, addSearch, clearSearches } = useRecentSearches();
  const updateStatus = useUpdateReportStatus();

  const { data: reports } = useReports({});
  const { data: rooms } = useRooms();
  const { data: branches } = useBranches({ enabled: isSuperAdmin });
  const { data: admins } = useAdmins({ enabled: isSuperAdmin });
  const { data: expenses } = useExpenses({});

  const quickActions = useMemo(() => getQuickActions(isAdmin), [isAdmin]);

  const searchableIndex = useMemo(
    () => buildSearchIndex({ reports, rooms, branches, admins, expenses }),
    [reports, rooms, branches, admins, expenses]
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setMode("default");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [mode]);

  function navigateTo(to: string) {
    if (query.trim()) addSearch(query);
    onOpenChange(false);
    navigate(to);
  }

  async function runStatusChange(reportId: string, status: "CHECKED_IN" | "CHECKED_OUT") {
    try {
      await updateStatus.mutateAsync({ id: reportId, status });
      toast.success(status === "CHECKED_IN" ? "Гость заселён" : "Гость выселен");
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const entries = useMemo<PaletteEntry[]>(() => {
    const q = query.trim().toLowerCase();

    if (mode === "checkin" || mode === "checkout") {
      const targetStatus = mode === "checkin" ? "RESERVED" : "CHECKED_IN";
      const candidates = (reports ?? [])
        .filter((r) => r.status === targetStatus)
        .filter((r) => !q || `${r.guestName ?? ""} ${r.room.roomNumber}`.toLowerCase().includes(q))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 30);

      return candidates.map((r) => ({
        key: r.id,
        label: r.guestName || "Без имени",
        subtitle: `Номер ${r.room.roomNumber} · ${r.branch.name}`,
        icon: mode === "checkin" ? LogIn : LogOut,
        group: mode === "checkin" ? "Заселить" : "Выселить",
        action: () => runStatusChange(r.id, mode === "checkin" ? "CHECKED_IN" : "CHECKED_OUT"),
      }));
    }

    if (!q) {
      const favItems: PaletteEntry[] = favorites
        .map((to) => ALL_NAV_ITEMS.find((i) => i.to === to))
        .filter((i): i is (typeof ALL_NAV_ITEMS)[number] => !!i)
        .map((i) => ({ key: `fav-${i.to}`, label: i.label, icon: i.icon, group: "Избранное", action: () => navigateTo(i.to) }));

      const recentItems: PaletteEntry[] = recent
        .map((to) => ALL_NAV_ITEMS.find((i) => i.to === to))
        .filter((i): i is (typeof ALL_NAV_ITEMS)[number] => !!i)
        .map((i) => ({ key: `recent-${i.to}`, label: i.label, icon: i.icon, group: "Недавние", action: () => navigateTo(i.to) }));

      const commandItems: PaletteEntry[] = [
        { key: "cmd-checkin", label: "Заселить гостя", icon: LogIn, group: "Команды", action: () => { setQuery(""); setMode("checkin"); } },
        { key: "cmd-checkout", label: "Выселить гостя", icon: LogOut, group: "Команды", action: () => { setQuery(""); setMode("checkout"); } },
      ];

      const actionItems: PaletteEntry[] = quickActions.map((a) => ({
        key: `action-${a.id}`,
        label: a.label,
        icon: a.icon,
        group: "Быстрые действия",
        action: () => navigateTo(a.to),
      }));

      const pageItems: PaletteEntry[] = ALL_NAV_ITEMS.map((i) => ({
        key: `page-${i.to}`,
        label: i.label,
        icon: i.icon,
        group: "Страницы",
        action: () => navigateTo(i.to),
      }));

      const seen = new Set<string>();
      return [...favItems, ...recentItems, ...commandItems, ...actionItems, ...pageItems].filter((e) => {
        if (seen.has(e.key)) return false;
        seen.add(e.key);
        return true;
      });
    }

    const pageMatches: PaletteEntry[] = [...ALL_NAV_ITEMS, ...quickActions]
      .filter((i) => i.label.toLowerCase().includes(q))
      .map((i) => ({ key: `nav-${i.to}`, label: i.label, icon: i.icon, group: "Страницы и действия", action: () => navigateTo(i.to) }));

    const dataMatches: PaletteEntry[] = searchIndex(searchableIndex, q).map((r) => ({
      key: r.id,
      label: r.title,
      subtitle: r.subtitle,
      icon: ENTITY_META[r.type].icon,
      group: ENTITY_META[r.type].label,
      action: () => navigateTo(r.to),
    }));

    return [...pageMatches, ...dataMatches];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mode, favorites, recent, searchableIndex, quickActions, reports]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, entries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = entries[activeIndex];
      if (entry) entry.action();
    } else if (e.key === "Backspace" && !query && mode !== "default") {
      e.preventDefault();
      setMode("default");
    }
  }

  let lastGroup: string | null = null;
  const modeLabel = mode === "checkin" ? "Заселение" : mode === "checkout" ? "Выселение" : null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0b1220]/45 backdrop-blur-xl data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="glass-strong fixed left-1/2 top-[12%] z-50 w-full max-w-[560px] -translate-x-1/2 overflow-hidden rounded-2xl focus:outline-none data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out"
        >
          <DialogPrimitive.Title className="sr-only">Командный центр</DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            {modeLabel ? (
              <button onClick={() => setMode("default")} className="flex shrink-0 items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[12px] font-medium text-foreground hover:bg-secondary/70">
                <ChevronLeft className="h-3.5 w-3.5" /> {modeLabel}
              </button>
            ) : (
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder={modeLabel ? "Имя гостя или номер…" : "Поиск и команды — гости, бронирования, номера…"}
              className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10.5px] text-muted-foreground">Esc</kbd>
          </div>

          {mode === "default" && !query.trim() && recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground/70">Недавние поиски</span>
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground hover:bg-secondary/70"
                >
                  <Clock className="h-2.5 w-2.5" /> {s}
                </button>
              ))}
              <button onClick={clearSearches} className="ml-auto text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === "default" ? -8 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="max-h-[60vh] overflow-y-auto p-1.5"
            >
              {entries.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {modeLabel ? "Подходящих броней не найдено" : "Ничего не найдено"}
                </p>
              )}
              {entries.map((entry, idx) => {
                const showGroupLabel = entry.group !== lastGroup;
                lastGroup = entry.group;
                const GroupIcon =
                  entry.group === "Избранное" ? Star : entry.group === "Недавние" ? Clock : entry.group === "Быстрые действия" ? Zap : entry.icon;
                return (
                  <div key={entry.key}>
                    {showGroupLabel && (
                      <p className="mt-2 px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground/70 first:mt-1">
                        {entry.group}
                      </p>
                    )}
                    <button
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => entry.action()}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors",
                        idx === activeIndex ? "bg-primary/[0.09] text-primary" : "text-foreground hover:bg-secondary"
                      )}
                    >
                      <GroupIcon className={cn("h-[15px] w-[15px] shrink-0", idx === activeIndex ? "text-primary" : "text-muted-foreground/80")} />
                      <span className="min-w-0 flex-1 truncate">
                        {entry.label}
                        {entry.subtitle && <span className="ml-1.5 truncate text-[11.5px] text-muted-foreground">{entry.subtitle}</span>}
                      </span>
                      {idx === activeIndex && <CornerDownLeft className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    </button>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
