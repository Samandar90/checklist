import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, History, ArrowRight, Loader2 } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/segmented";

import { useAudit } from "@/hooks/useAudit";
import { AuditFilters, AuditLog } from "@/types";
import { cn, formatDate, formatDateTime, addDaysIso, todayIso } from "@/lib/utils";
import { categorize, iconFor, CATEGORY_META, TimelineCategory, CategorizedLog } from "@/lib/timelineCategorize";

type Grouping = "day" | "booking";

const CATEGORY_ORDER: TimelineCategory[] = ["booking", "status", "room", "payment", "other"];


function matchesSearch(entry: CategorizedLog, q: string) {
  if (!q) return true;
  const haystack = `${entry.log.summary} ${entry.log.actorName}`.toLowerCase();
  return haystack.includes(q);
}

export default function TimelinePage() {
  const [from, setFrom] = useState(addDaysIso(todayIso(), -14));
  const [to, setTo] = useState(todayIso());
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<TimelineCategory>>(new Set(CATEGORY_ORDER));
  const [grouping, setGrouping] = useState<Grouping>("day");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AuditLog[]>([]);

  const filters: AuditFilters = useMemo(() => ({ entity: "report", from, to, page }), [from, to, page]);
  const { data, isLoading, isFetching } = useAudit(filters);

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [from, to]);

  useEffect(() => {
    if (!data) return;
    setItems((prev) => (data.page === 1 ? data.items : [...prev, ...data.items]));
  }, [data]);

  const categorized = useMemo(() => items.map(categorize), [items]);

  const filtered = useMemo(
    () =>
      categorized.filter((e) => e.categories.some((c) => activeCategories.has(c)) && matchesSearch(e, search.trim().toLowerCase())),
    [categorized, activeCategories, search]
  );

  const groups = useMemo(() => {
    const map = new Map<string, CategorizedLog[]>();
    for (const entry of filtered) {
      const key = grouping === "day" ? formatDate(entry.log.createdAt) : entry.log.entityId ?? "Массовые действия";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return Array.from(map.entries());
  }, [filtered, grouping]);

  function toggleCategory(cat: TimelineCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next.size === 0 ? new Set(CATEGORY_ORDER) : next;
    });
  }

  const hasMore = data ? data.page * data.pageSize < data.total : false;

  return (
    <div>
      <PageHeader
        title="Хронология"
        description="Каждое бронирование, оплата, смена номера и изменение статуса — в одной ленте."
      />

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56 space-y-1.5">
            <Label>Поиск</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Гость, номер, сотрудник…" className="pl-8" />
            </div>
          </div>
          <div className="w-40 space-y-1.5">
            <Label>С</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="w-40 space-y-1.5">
            <Label>По</Label>
            <Input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Группировка</Label>
            <Segmented
              options={[
                { value: "day", label: "По дням" },
                { value: "booking", label: "По брони" },
              ]}
              value={grouping}
              onChange={setGrouping}
            />
          </div>
          {search && (
            <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
              <X className="h-3.5 w-3.5" /> Очистить поиск
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
          {CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = activeCategories.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  active ? meta.tint : "bg-secondary text-muted-foreground"
                )}
              >
                <meta.icon className="h-3 w-3" /> {meta.label}
              </button>
            );
          })}
        </div>
      </Card>

      {isLoading && items.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState icon={History} title="Событий не найдено" description="Измените период или фильтры, чтобы увидеть историю." />
      ) : (
        <div className="relative pl-7">
          <div className="absolute bottom-0 left-[10px] top-1 w-px bg-border" />
          <AnimatePresence initial={false}>
            {groups.map(([groupKey, entries], gi) => (
              <motion.div
                key={groupKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: gi * 0.03 }}
                className="mb-6"
              >
                <div className="sticky top-16 z-10 mb-3 -ml-7 flex items-center gap-2 bg-background/90 py-1 pl-0 backdrop-blur-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" style={{ marginLeft: "5px" }} />
                  <span className="text-[12.5px] font-semibold uppercase tracking-wide text-foreground">
                    {grouping === "day" ? groupKey : `Бронь #${groupKey.slice(-6).toUpperCase()}`}
                  </span>
                  <span className="text-xs text-muted-foreground">· {entries.length} событий</span>
                </div>

                <div className="space-y-2">
                  {entries.map((entry, i) => {
                    const Icon = iconFor(entry);
                    const meta = CATEGORY_META[entry.primary];
                    return (
                      <motion.div
                        key={entry.log.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.02 }}
                        className="relative flex gap-3 rounded-xl border border-border bg-card p-3 shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition-colors hover:border-foreground/15"
                      >
                        <span className={cn("absolute -left-[34px] top-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background", meta.tint)}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{entry.log.actorName}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", meta.tint)}>{meta.label}</span>
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">{entry.log.summary}</p>
                          {entry.changes.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {entry.changes.map((c) => (
                                <span key={c.field} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 text-[11px]">
                                  <span className="text-muted-foreground">{c.label}:</span>
                                  <span className="text-foreground line-through decoration-muted-foreground/50">{c.from}</span>
                                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                                  <span className="font-medium text-foreground">{c.to}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(entry.log.createdAt)}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {hasMore && (
            <div className="flex justify-center pb-2">
              <Button variant="outline" size="sm" disabled={isFetching} onClick={() => setPage((p) => p + 1)}>
                {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Показать ещё
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
