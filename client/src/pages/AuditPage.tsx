import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  History,
  Search,
  X,
  ArrowRight,
  Download,
  Loader2,
  ClipboardList,
  Wallet,
  Building2,
  Users,
  BedDouble,
  Megaphone,
} from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/segmented";

import { useAudit } from "@/hooks/useAudit";
import { AuditFilters, AuditFieldChange, AuditLog } from "@/types";
import { cn, formatDate, formatDateTime, addDaysIso } from "@/lib/utils";
import { exportAuditToCsv } from "@/lib/csv";

type Grouping = "day" | "actor";

// ── Entity meta ──────────────────────────────────────────────────────────────
const ENTITY_ORDER = ["report", "expense", "branch", "admin", "room", "source"] as const;
type EntityKey = (typeof ENTITY_ORDER)[number];

const ENTITY_META: Record<EntityKey, { label: string; icon: typeof ClipboardList; tint: string }> = {
  report:  { label: "Отчёт",          icon: ClipboardList, tint: "tint-sky" },
  expense: { label: "Расход",          icon: Wallet,        tint: "tint-amber" },
  branch:  { label: "Филиал",          icon: Building2,     tint: "tint-violet" },
  admin:   { label: "Администратор",   icon: Users,         tint: "tint-indigo" },
  room:    { label: "Номер",           icon: BedDouble,     tint: "tint-emerald" },
  source:  { label: "Источник",        icon: Megaphone,     tint: "tint-rose" },
};

// ── Action meta ───────────────────────────────────────────────────────────────
const ACTION_ORDER = ["CREATE", "UPDATE", "DELETE"] as const;
type ActionKey = (typeof ACTION_ORDER)[number];

const ACTION_META: Record<ActionKey, { label: string; icon: typeof Plus; tint: string }> = {
  CREATE: { label: "Добавление", icon: Plus,   tint: "tint-emerald" },
  UPDATE: { label: "Изменение",  icon: Pencil, tint: "tint-amber" },
  DELETE: { label: "Удаление",   icon: Trash2, tint: "tint-rose" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseChanges(raw: string | null): AuditFieldChange[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as AuditFieldChange[]; } catch { return []; }
}

function matchesSearch(log: AuditLog, q: string) {
  if (!q) return true;
  return `${log.summary} ${log.actorName}`.toLowerCase().includes(q);
}

// ── Timeline entry card ───────────────────────────────────────────────────────
function AuditEntry({ log, index }: { log: AuditLog; index: number }) {
  const entityMeta = ENTITY_META[log.entity as EntityKey];
  const actionMeta = ACTION_META[log.action as ActionKey] ?? ACTION_META.UPDATE;
  const ActionIcon = actionMeta.icon;
  const EntityIcon = entityMeta?.icon ?? ClipboardList;
  const changes = parseChanges(log.changes);

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className="relative flex gap-3 rounded-xl border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition-colors hover:border-foreground/15"
    >
      {/* timeline dot */}
      <span
        className={cn(
          "absolute -left-[34px] top-3.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
          actionMeta.tint
        )}
      >
        <ActionIcon className="h-3.5 w-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground">{log.actorName}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
            {log.actorRole === "SUPER_ADMIN" ? "Главный" : "Админ"}
          </span>
          {/* action badge */}
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", actionMeta.tint)}>
            <ActionIcon className="h-2.5 w-2.5" /> {actionMeta.label}
          </span>
          {/* entity badge */}
          {entityMeta && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", entityMeta.tint)}>
              <EntityIcon className="h-2.5 w-2.5" /> {entityMeta.label}
            </span>
          )}
        </div>

        <p className="mt-0.5 text-sm text-muted-foreground">{log.summary}</p>

        {changes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {changes.map((c) => (
              <span
                key={c.field}
                className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 text-[11px]"
              >
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
        {formatDateTime(log.createdAt)}
      </span>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AuditPage() {
  const [from, setFrom] = useState(addDaysIso(todayIso(), -30));
  const [to, setTo] = useState(todayIso());
  const [search, setSearch] = useState("");
  const [activeEntities, setActiveEntities] = useState<Set<EntityKey>>(new Set(ENTITY_ORDER));
  const [activeActions, setActiveActions] = useState<Set<ActionKey>>(new Set(ACTION_ORDER));
  const [grouping, setGrouping] = useState<Grouping>("day");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AuditLog[]>([]);

  const filters: AuditFilters = useMemo(() => ({ from, to, page }), [from, to, page]);
  const { data, isLoading, isFetching } = useAudit(filters);

  // Reset accumulation when date range changes
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [from, to]);

  // Accumulate pages
  useEffect(() => {
    if (!data) return;
    setItems((prev) => (data.page === 1 ? data.items : [...prev, ...data.items]));
  }, [data]);

  const filtered = useMemo(
    () =>
      items.filter(
        (log) =>
          activeEntities.has(log.entity as EntityKey) &&
          activeActions.has(log.action as ActionKey) &&
          matchesSearch(log, search.trim().toLowerCase())
      ),
    [items, activeEntities, activeActions, search]
  );

  const groups = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    for (const log of filtered) {
      const key = grouping === "day" ? formatDate(log.createdAt) : log.actorName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }
    return Array.from(map.entries());
  }, [filtered, grouping]);

  function toggleEntity(e: EntityKey) {
    setActiveEntities((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e); else next.add(e);
      return next.size === 0 ? new Set(ENTITY_ORDER) : next;
    });
  }

  function toggleAction(a: ActionKey) {
    setActiveActions((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a); else next.add(a);
      return next.size === 0 ? new Set(ACTION_ORDER) : next;
    });
  }

  const hasMore = data ? data.page * data.pageSize < data.total : false;
  const hasAnyFilter =
    activeEntities.size < ENTITY_ORDER.length ||
    activeActions.size < ACTION_ORDER.length ||
    Boolean(search);

  return (
    <div>
      <PageHeader
        title="Журнал изменений"
        description="Все действия пользователей — кто, когда и что изменил."
        action={
          filtered.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => exportAuditToCsv(filtered)}>
              <Download className="h-3.5 w-3.5" /> Экспорт CSV
            </Button>
          ) : undefined
        }
      />

      {/* ── Toolbar ── */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="w-56 space-y-1.5">
            <Label>Поиск</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Пользователь, событие…"
                className="pl-8"
              />
            </div>
          </div>

          {/* Date range */}
          <div className="w-40 space-y-1.5">
            <Label>С</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="w-40 space-y-1.5">
            <Label>По</Label>
            <Input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          {/* Grouping */}
          <div className="space-y-1.5">
            <Label>Группировка</Label>
            <Segmented
              options={[
                { value: "day", label: "По дням" },
                { value: "actor", label: "По автору" },
              ]}
              value={grouping}
              onChange={setGrouping}
            />
          </div>

          {hasAnyFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setActiveEntities(new Set(ENTITY_ORDER));
                setActiveActions(new Set(ACTION_ORDER));
              }}
            >
              <X className="h-3.5 w-3.5" /> Сбросить
            </Button>
          )}
        </div>

        {/* Entity + Action chip filters */}
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
          {ENTITY_ORDER.map((e) => {
            const meta = ENTITY_META[e];
            const active = activeEntities.has(e);
            return (
              <button
                key={e}
                onClick={() => toggleEntity(e)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  active ? meta.tint : "bg-secondary text-muted-foreground"
                )}
              >
                <meta.icon className="h-3 w-3" /> {meta.label}
              </button>
            );
          })}

          <span className="mx-1 self-center text-border">|</span>

          {ACTION_ORDER.map((a) => {
            const meta = ACTION_META[a];
            const active = activeActions.has(a);
            return (
              <button
                key={a}
                onClick={() => toggleAction(a)}
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

      {/* ── Timeline ── */}
      {isLoading && items.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={History}
          title="Записей не найдено"
          description="Измените период или фильтры, чтобы увидеть историю."
        />
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
                {/* Sticky group header */}
                <div className="sticky top-16 z-10 mb-3 -ml-7 flex items-center gap-2 bg-background/90 py-1 backdrop-blur-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" style={{ marginLeft: "5px" }} />
                  <span className="text-[12.5px] font-semibold uppercase tracking-wide text-foreground">
                    {groupKey}
                  </span>
                  <span className="text-xs text-muted-foreground">· {entries.length} событий</span>
                </div>

                <div className="space-y-2">
                  {entries.map((log, i) => (
                    <AuditEntry key={log.id} log={log} index={i} />
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {hasMore && (
            <div className="flex justify-center pb-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Показать ещё
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
