import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LayoutGrid, List as ListIcon, BedDouble, User2, Sparkles, Clock } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBranches, useMyBranches } from "@/hooks/useBranches";
import { useRooms } from "@/hooks/useRooms";
import { useCalendar } from "@/hooks/useCalendar";
import { useHousekeeping, HKStatus, HKPriority } from "@/hooks/useHousekeeping";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatDateTime } from "@/lib/utils";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}
const today = isoDay(new Date());

const statusMeta: Record<HKStatus, { label: string; tint: string }> = {
  Clean: { label: "Чисто", tint: "tint-emerald" },
  Dirty: { label: "Грязно", tint: "tint-rose" },
  Cleaning: { label: "Уборка", tint: "tint-sky" },
  Inspection: { label: "Проверка", tint: "tint-violet" },
  OutOfOrder: { label: "Не работает", tint: "tint-slate" },
  Maintenance: { label: "Ремонт", tint: "tint-amber" },
};
const priorityMeta: Record<HKPriority, { label: string; cls: string }> = {
  Low: { label: "Низкий", cls: "text-muted-foreground" },
  Medium: { label: "Средний", cls: "text-amber-600" },
  High: { label: "Высокий", cls: "text-destructive" },
};
const kanbanCols: HKStatus[] = ["Dirty", "Cleaning", "Inspection", "Clean"];

export default function HousekeepingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const isMultiBranchAdmin = isAdmin && (user?.branchIds?.length ?? 0) > 1;
  const { data: branches } = useBranches({ enabled: !isAdmin });
  const { data: myBranches } = useMyBranches({ enabled: isMultiBranchAdmin });
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const effectiveBranchId = isMultiBranchAdmin
    ? branchId ?? user?.branchId ?? myBranches?.[0]?.id
    : isAdmin
      ? user?.branchId ?? undefined
      : branchId ?? branches?.[0]?.id;
  const { data: rooms, isLoading } = useRooms();
  const { data: calendar } = useCalendar(effectiveBranchId, today, today);
  const hk = useHousekeeping();

  const [mode, setMode] = useState<"kanban" | "list">("kanban");
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<HKStatus | undefined>(undefined);
  const [priorityFilter, setPriorityFilter] = useState<HKPriority | undefined>(undefined);
  const [floorFilter, setFloorFilter] = useState<string | undefined>(undefined);

  const branchRooms = useMemo(() => (rooms ?? []).filter((r) => r.branchId === effectiveBranchId), [rooms, effectiveBranchId]);

  const guestByRoom = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of calendar?.bookings ?? []) {
      const start = b.date.slice(0, 10);
      const end = b.checkOut ? b.checkOut.slice(0, 10) : start;
      if (start <= today && today < end) map.set(b.roomId, b.guestName || b.source?.name || "Гость");
    }
    return map;
  }, [calendar]);

  const types = useMemo(() => Array.from(new Set(branchRooms.map((r) => r.type?.trim()).filter(Boolean))) as string[], [branchRooms]);
  const floorOf = (roomNumber: string) => roomNumber.trim().charAt(0) || "?";
  const floors = useMemo(() => Array.from(new Set(branchRooms.map((r) => floorOf(r.roomNumber)))).sort(), [branchRooms]);

  const filteredRooms = useMemo(() => {
    return branchRooms.filter((r) => {
      const state = hk.get(r.id);
      if (typeFilter && r.type !== typeFilter) return false;
      if (statusFilter && state.status !== statusFilter) return false;
      if (priorityFilter && state.priority !== priorityFilter) return false;
      if (floorFilter && floorOf(r.roomNumber) !== floorFilter) return false;
      return true;
    });
  }, [branchRooms, typeFilter, statusFilter, priorityFilter, floorFilter, hk]);

  const counts = useMemo(() => {
    const c: Record<HKStatus, number> = { Clean: 0, Dirty: 0, Cleaning: 0, Inspection: 0, OutOfOrder: 0, Maintenance: 0 };
    for (const r of branchRooms) c[hk.get(r.id).status]++;
    return c;
  }, [branchRooms, hk]);

  return (
    <div>
      <PageHeader title="Хозяйственная служба" description="Статус уборки номеров в реальном времени." />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-end gap-3">
          {(!isAdmin || isMultiBranchAdmin) && (
          <div className="w-48 space-y-1.5">
            <Label>Филиал</Label>
            <Select value={effectiveBranchId ?? ""} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите филиал" />
              </SelectTrigger>
              <SelectContent>
                {(isMultiBranchAdmin ? myBranches ?? [] : branches ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}
          <FilterSelect label="Этаж" value={floorFilter} onChange={setFloorFilter} options={floors.map((f) => ({ value: f, label: f }))} />
          <FilterSelect label="Тип номера" value={typeFilter} onChange={setTypeFilter} options={types.map((t) => ({ value: t, label: t }))} />
          <FilterSelect
            label="Статус"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as HKStatus | undefined)}
            options={Object.entries(statusMeta).map(([k, m]) => ({ value: k, label: m.label }))}
          />
          <FilterSelect
            label="Приоритет"
            value={priorityFilter}
            onChange={(v) => setPriorityFilter(v as HKPriority | undefined)}
            options={Object.entries(priorityMeta).map(([k, m]) => ({ value: k, label: m.label }))}
          />
        </div>

        <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/60 p-1">
          <button onClick={() => setMode("kanban")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all", mode === "kanban" ? "bg-card text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted-foreground")}>
            <LayoutGrid className="h-3.5 w-3.5" /> Канбан
          </button>
          <button onClick={() => setMode("list")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all", mode === "list" ? "bg-card text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted-foreground")}>
            <ListIcon className="h-3.5 w-3.5" /> Список
          </button>
        </div>
      </div>

      {/* Сводка по статусам */}
      <Card className="mb-5">
        <div className="grid grid-cols-3 divide-x divide-y divide-border sm:grid-cols-6 sm:divide-y-0">
          {(Object.keys(statusMeta) as HKStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-2.5 p-3.5">
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold", statusMeta[s].tint)}>{counts[s]}</span>
              <span className="truncate text-[11.5px] text-muted-foreground">{statusMeta[s].label}</span>
            </div>
          ))}
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : !effectiveBranchId || branchRooms.length === 0 ? (
        <EmptyState icon={BedDouble} title="Нет номеров" description="В этом филиале ещё нет номеров." />
      ) : mode === "kanban" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kanbanCols.map((col) => {
            const colRooms = filteredRooms.filter((r) => hk.get(r.id).status === col);
            return (
              <div key={col} className="space-y-2.5">
                <div className="flex items-center gap-2 px-1">
                  <span className={cn("h-2 w-2 rounded-full", statusMeta[col].tint)} />
                  <span className="text-[12.5px] font-semibold text-foreground">{statusMeta[col].label}</span>
                  <span className="text-[11px] text-muted-foreground">{colRooms.length}</span>
                </div>
                <div className="space-y-2.5">
                  {colRooms.map((r) => (
                    <RoomCard key={r.id} room={r} guest={guestByRoom.get(r.id)} hk={hk} />
                  ))}
                  {colRooms.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">Пусто</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredRooms.map((r) => (
            <RoomCard key={r.id} room={r} guest={guestByRoom.get(r.id)} hk={hk} list />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: { value: string; label: string }[];
}) {
  if (options.length === 0) return null;
  return (
    <div className="w-36 space-y-1.5">
      <Label>{label}</Label>
      <Select value={value ?? "all"} onValueChange={(v) => onChange(v === "all" ? undefined : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Все" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RoomCard({
  room,
  guest,
  hk,
  list,
}: {
  room: { id: string; roomNumber: string; type?: string | null };
  guest?: string;
  hk: ReturnType<typeof useHousekeeping>;
  list?: boolean;
}) {
  const state = hk.get(room.id);
  return (
    <motion.div layout transition={{ duration: 0.2 }}>
      <Card>
        <CardContent className={cn("p-3.5", list && "flex flex-wrap items-center gap-4")}>
          <div className={cn("flex items-center justify-between gap-2", list && "w-40 shrink-0 justify-start")}>
            <div>
              <p className="text-sm font-semibold text-foreground">{room.roomNumber}</p>
              {room.type && <p className="text-[11px] text-muted-foreground">{room.type}</p>}
            </div>
            {!list && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusMeta[state.status].tint)}>{statusMeta[state.status].label}</span>}
          </div>

          <div className={cn("mt-2 space-y-1.5 text-[11.5px] text-muted-foreground", list && "mt-0 flex flex-1 flex-wrap items-center gap-4 space-y-0")}>
            <p className="flex items-center gap-1.5">
              <User2 className="h-3 w-3" /> {guest ?? "Свободен"}
            </p>
            <p className={cn("flex items-center gap-1.5", priorityMeta[state.priority].cls)}>
              <Sparkles className="h-3 w-3" /> {priorityMeta[state.priority].label}
            </p>
            {state.lastCleaned && (
              <p className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> {formatDateTime(state.lastCleaned)}
              </p>
            )}
          </div>

          <div className={cn("mt-2.5 flex flex-wrap items-center gap-1.5", list && "mt-0 ml-auto")}>
            {list && <Badge className={statusMeta[state.status].tint}>{statusMeta[state.status].label}</Badge>}
            <Select value={state.status} onValueChange={(v) => hk.setStatus(room.id, v as HKStatus)}>
              <SelectTrigger className="h-7 w-[110px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(statusMeta) as HKStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusMeta[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={state.priority} onValueChange={(v) => hk.setPriority(room.id, v as HKPriority)}>
              <SelectTrigger className="h-7 w-[90px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(priorityMeta) as HKPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {priorityMeta[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={state.housekeeper}
              onChange={(e) => hk.setHousekeeper(room.id, e.target.value)}
              placeholder="Горничная"
              className="h-7 w-28 text-[11px]"
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
