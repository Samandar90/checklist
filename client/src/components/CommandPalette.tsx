import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { Search, Star, Clock, Zap, CornerDownLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_NAV_ITEMS, QUICK_ACTIONS } from "@/lib/nav";
import { useAuth } from "@/contexts/AuthContext";
import { useReports } from "@/hooks/useReports";
import { useRooms } from "@/hooks/useRooms";
import { useBranches } from "@/hooks/useBranches";
import { useAdmins } from "@/hooks/useAdmins";
import { useExpenses } from "@/hooks/useExpenses";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { buildSearchIndex, searchIndex, ENTITY_META } from "@/lib/globalSearch";

interface PaletteEntry {
  key: string;
  label: string;
  subtitle?: string;
  to: string;
  icon: typeof Search;
  group: string;
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
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const { recentSearches, addSearch, clearSearches } = useRecentSearches();

  const { data: reports } = useReports({});
  const { data: rooms } = useRooms();
  const { data: branches } = useBranches({ enabled: isSuperAdmin });
  const { data: admins } = useAdmins({ enabled: isSuperAdmin });
  const { data: expenses } = useExpenses({});

  const searchableIndex = useMemo(
    () => buildSearchIndex({ reports, rooms, branches, admins, expenses }),
    [reports, rooms, branches, admins, expenses]
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      const favItems: PaletteEntry[] = favorites
        .map((to) => ALL_NAV_ITEMS.find((i) => i.to === to))
        .filter((i): i is (typeof ALL_NAV_ITEMS)[number] => !!i)
        .map((i) => ({ key: `fav-${i.to}`, label: i.label, to: i.to, icon: i.icon, group: "Избранное" }));

      const recentItems: PaletteEntry[] = recent
        .map((to) => ALL_NAV_ITEMS.find((i) => i.to === to))
        .filter((i): i is (typeof ALL_NAV_ITEMS)[number] => !!i)
        .map((i) => ({ key: `recent-${i.to}`, label: i.label, to: i.to, icon: i.icon, group: "Недавние" }));

      const actionItems: PaletteEntry[] = QUICK_ACTIONS.map((a) => ({
        key: `action-${a.id}`,
        label: a.label,
        to: a.to,
        icon: a.icon,
        group: "Быстрые действия",
      }));

      const pageItems: PaletteEntry[] = ALL_NAV_ITEMS.map((i) => ({
        key: `page-${i.to}`,
        label: i.label,
        to: i.to,
        icon: i.icon,
        group: "Страницы",
      }));

      const seen = new Set<string>();
      return [...favItems, ...recentItems, ...actionItems, ...pageItems].filter((e) => {
        const dedupeKey = `${e.group}-${e.to}`;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      });
    }

    const pageMatches: PaletteEntry[] = [...ALL_NAV_ITEMS, ...QUICK_ACTIONS]
      .filter((i) => i.label.toLowerCase().includes(q))
      .map((i) => ({ key: `nav-${i.to}`, label: i.label, to: i.to, icon: i.icon, group: "Страницы и действия" }));

    const dataMatches: PaletteEntry[] = searchIndex(searchableIndex, q).map((r) => ({
      key: r.id,
      label: r.title,
      subtitle: r.subtitle,
      to: r.to,
      icon: ENTITY_META[r.type].icon,
      group: ENTITY_META[r.type].label,
    }));

    return [...pageMatches, ...dataMatches];
  }, [query, favorites, recent, searchableIndex]);

  function go(entry: PaletteEntry) {
    if (query.trim()) addSearch(query);
    onOpenChange(false);
    navigate(entry.to);
  }

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
      if (entry) go(entry);
    }
  }

  let lastGroup: string | null = null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/60 backdrop-blur-[2px] data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="fixed left-1/2 top-[12%] z-50 w-full max-w-[560px] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_rgba(16,24,40,0.18)] focus:outline-none data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out"
        >
          <DialogPrimitive.Title className="sr-only">Глобальный поиск</DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder="Гости, бронирования, номера, счета, филиалы…"
              className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10.5px] text-muted-foreground">Esc</kbd>
          </div>

          {!query.trim() && recentSearches.length > 0 && (
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

          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {entries.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено</p>
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
                    onClick={() => go(entry)}
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
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
