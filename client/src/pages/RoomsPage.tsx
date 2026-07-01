import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BedDouble, Search, LayoutGrid, List as ListIcon, User2, Wallet, TrendingUp, Wrench, ArrowUpDown } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRooms, useCreateRoom, useDeleteRoom, useUpdateRoom } from "@/hooks/useRooms";
import { useBranches } from "@/hooks/useBranches";
import { useReports } from "@/hooks/useReports";
import { useHousekeeping, HKStatus } from "@/hooks/useHousekeeping";
import { Room } from "@/types";
import { getErrorMessage } from "@/lib/api";
import { cn, formatMoney } from "@/lib/utils";

const roomFormSchema = z.object({
  roomNumber: z.string().trim().min(1, "Укажите номер комнаты"),
  type: z.string().trim().optional(),
  branchId: z.string().trim().min(1, "Выберите филиал"),
});
type RoomFormValues = z.infer<typeof roomFormSchema>;

const ROOM_TYPE_SUGGESTIONS = ["DBL", "TWIN", "SGL", "Lux", "Suite"];

const statusMeta: Record<HKStatus, { label: string; tint: string }> = {
  Clean: { label: "Чисто", tint: "tint-emerald" },
  Dirty: { label: "Грязно", tint: "tint-rose" },
  Cleaning: { label: "Уборка", tint: "tint-sky" },
  Inspection: { label: "Проверка", tint: "tint-violet" },
  OutOfOrder: { label: "Не работает", tint: "tint-slate" },
  Maintenance: { label: "Ремонт", tint: "tint-amber" },
};

const today = new Date().toISOString().slice(0, 10);
type SortKey = "roomNumber" | "revenue" | "occupancy";

export default function RoomsPage() {
  const { data: rooms, isLoading } = useRooms();
  const { data: branches } = useBranches();
  const { data: reports } = useReports({});
  const hk = useHousekeeping();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();

  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<HKStatus | undefined>(undefined);
  const [sortKey, setSortKey] = useState<SortKey>("roomNumber");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);

  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: { roomNumber: "", type: "", branchId: "" },
  });

  // Per-room signals derived from existing bookings — no schema change.
  const { guestByRoom, revenueByRoom, lastPriceByRoom, occupiedToday } = useMemo(() => {
    const guest = new Map<string, string>();
    const revenue = new Map<string, number>();
    const lastPrice = new Map<string, { price: number; currency: string; date: string }>();
    const occupied = new Set<string>();
    for (const r of reports ?? []) {
      revenue.set(r.roomId, (revenue.get(r.roomId) ?? 0) + r.price);
      const start = r.date.slice(0, 10);
      const end = r.checkOut ? r.checkOut.slice(0, 10) : start;
      if (start <= today && today < end) {
        occupied.add(r.roomId);
        guest.set(r.roomId, r.guestName || r.source?.name || "Гость");
      }
      const cur = lastPrice.get(r.roomId);
      if (!cur || r.date > cur.date) lastPrice.set(r.roomId, { price: r.price, currency: r.currency, date: r.date });
    }
    return { guestByRoom: guest, revenueByRoom: revenue, lastPriceByRoom: lastPrice, occupiedToday: occupied };
  }, [reports]);

  const types = useMemo(() => Array.from(new Set((rooms ?? []).map((r) => r.type?.trim()).filter(Boolean))) as string[], [rooms]);
  const floorOf = (n: string) => n.trim().charAt(0) || "?";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = (rooms ?? []).filter((r) => {
      if (q && !r.roomNumber.toLowerCase().includes(q)) return false;
      if (branchFilter && r.branchId !== branchFilter) return false;
      if (typeFilter && r.type !== typeFilter) return false;
      if (statusFilter && hk.get(r.id).status !== statusFilter) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortKey === "revenue") return (revenueByRoom.get(b.id) ?? 0) - (revenueByRoom.get(a.id) ?? 0);
      if (sortKey === "occupancy") return Number(occupiedToday.has(b.id)) - Number(occupiedToday.has(a.id));
      return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
    });
    return list;
  }, [rooms, search, branchFilter, typeFilter, statusFilter, sortKey, hk, revenueByRoom, occupiedToday]);

  const stats = useMemo(() => {
    const total = rooms?.length ?? 0;
    const occ = occupiedToday.size;
    const totalRevenue = Array.from(revenueByRoom.values()).reduce((s, v) => s + v, 0);
    const maintenance = (rooms ?? []).filter((r) => ["OutOfOrder", "Maintenance"].includes(hk.get(r.id).status)).length;
    return {
      occupancyPct: total ? Math.round((occ / total) * 100) : 0,
      totalRevenue,
      maintenance,
      total,
    };
  }, [rooms, occupiedToday, revenueByRoom, hk]);

  function openCreate() {
    setEditing(null);
    form.reset({ roomNumber: "", type: "", branchId: "" });
    setDialogOpen(true);
  }
  function openEdit(room: Room) {
    setEditing(room);
    form.reset({ roomNumber: room.roomNumber, type: room.type ?? "", branchId: room.branchId });
    setDialogOpen(true);
  }
  async function onSubmit(values: RoomFormValues) {
    try {
      if (editing) {
        await updateRoom.mutateAsync({ id: editing.id, data: values });
        toast.success("Номер обновлён");
      } else {
        await createRoom.mutateAsync(values);
        toast.success("Номер создан");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteRoom.mutateAsync(deleteTarget.id);
      toast.success("Номер удалён");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const noBranches = (branches ?? []).length === 0;

  return (
    <div>
      <PageHeader
        title="Номера"
        description="Управление номерным фондом по всем филиалам."
        action={
          <Button onClick={openCreate} disabled={noBranches}>
            <Plus className="h-4 w-4" /> Добавить номер
          </Button>
        }
      />

      {noBranches && (
        <div className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
          Сначала создайте филиал, чтобы добавить номер.
        </div>
      )}

      {/* Статистика */}
      <Card className="mb-5">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          <Stat icon={BedDouble} tint="tint-indigo" label="Всего номеров" value={String(stats.total)} />
          <Stat icon={TrendingUp} tint="tint-emerald" label="Загрузка сегодня" value={`${stats.occupancyPct}%`} />
          <Stat icon={Wallet} tint="tint-amber" label="Выручка (всё время)" value={`${Math.round(stats.totalRevenue / 1000)}к`} />
          <Stat icon={Wrench} tint="tint-rose" label="На обслуживании" value={String(stats.maintenance)} />
        </div>
      </Card>

      {/* Фильтры */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48 space-y-1.5">
            <Label>Поиск</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Номер комнаты…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
          </div>
          <FilterSelect label="Филиал" value={branchFilter} onChange={setBranchFilter} options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
          <FilterSelect label="Тип" value={typeFilter} onChange={setTypeFilter} options={types.map((t) => ({ value: t, label: t }))} />
          <FilterSelect
            label="Статус"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as HKStatus | undefined)}
            options={Object.entries(statusMeta).map(([k, m]) => ({ value: k, label: m.label }))}
          />
          <div className="w-40 space-y-1.5">
            <Label>Сортировка</Label>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger>
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="roomNumber">По номеру</SelectItem>
                <SelectItem value="revenue">По выручке</SelectItem>
                <SelectItem value="occupancy">По загрузке</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/60 p-1">
          <button onClick={() => setView("grid")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all", view === "grid" ? "bg-card text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted-foreground")}>
            <LayoutGrid className="h-3.5 w-3.5" /> Сетка
          </button>
          <button onClick={() => setView("table")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all", view === "table" ? "bg-card text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted-foreground")}>
            <ListIcon className="h-3.5 w-3.5" /> Таблица
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="Номера не найдены"
          description="Измените фильтры или добавьте новый номер."
          action={
            <Button onClick={openCreate} disabled={noBranches}>
              <Plus className="h-4 w-4" /> Добавить номер
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((room) => {
            const status = hk.get(room.id).status;
            const last = lastPriceByRoom.get(room.id);
            return (
              <Card key={room.id} className="overflow-hidden">
                <div className="flex h-24 items-center justify-center bg-secondary/60 text-muted-foreground">
                  <BedDouble className="h-8 w-8 opacity-40" />
                </div>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{room.roomNumber}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {room.type || "Без типа"} · этаж {floorOf(room.roomNumber)} · {room.branch?.name ?? "—"}
                      </p>
                    </div>
                    <Badge className={statusMeta[status].tint}>{statusMeta[status].label}</Badge>
                  </div>
                  <div className="space-y-1 text-[11.5px] text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <User2 className="h-3 w-3" /> {guestByRoom.get(room.id) ?? "Свободен"}
                    </p>
                    {last && (
                      <p className="flex items-center gap-1.5">
                        <Wallet className="h-3 w-3" /> {formatMoney(last.price, last.currency)} <span className="text-muted-foreground/70">(посл. бронь)</span>
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex justify-end gap-1 border-t border-border pt-2.5">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(room)} aria-label="Редактировать">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(room)} aria-label="Удалить">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Номер</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Этаж</TableHead>
              <TableHead>Филиал</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Гость</TableHead>
              <TableHead>Цена (посл.)</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((room) => {
              const status = hk.get(room.id).status;
              const last = lastPriceByRoom.get(room.id);
              return (
                <TableRow key={room.id}>
                  <TableCell className="font-medium text-foreground">{room.roomNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{room.type || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{floorOf(room.roomNumber)}</TableCell>
                  <TableCell>{room.branch?.name ?? "-"}</TableCell>
                  <TableCell>
                    <Badge className={statusMeta[status].tint}>{statusMeta[status].label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{guestByRoom.get(room.id) ?? "Свободен"}</TableCell>
                  <TableCell className="text-muted-foreground">{last ? formatMoney(last.price, last.currency) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(room)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(room)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать номер" : "Добавить номер"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="roomNumber">Номер комнаты</Label>
              <Input id="roomNumber" placeholder="например, 101" {...form.register("roomNumber")} />
              {form.formState.errors.roomNumber && <p className="text-xs text-destructive">{form.formState.errors.roomNumber.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Тип номера</Label>
              <Input id="type" list="room-type-suggestions" placeholder="например, DBL, TWIN" {...form.register("type")} />
              <datalist id="room-type-suggestions">
                {ROOM_TYPE_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Филиал</Label>
              <Controller
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выбрать" />
                    </SelectTrigger>
                    <SelectContent>
                      {(branches ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.branchId && <p className="text-xs text-destructive">{form.formState.errors.branchId.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? "Сохранить изменения" : "Создать номер"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteRoom.isPending}
        title="Удалить номер?"
        description={`Номер «${deleteTarget?.roomNumber}» будет удалён без возможности восстановления.`}
      />
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
    <div className="w-40 space-y-1.5">
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

function Stat({ icon: Icon, tint, label, value }: { icon: typeof BedDouble; tint: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tint)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-lg font-semibold tabular-nums text-foreground">{value}</div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
