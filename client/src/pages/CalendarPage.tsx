import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  BedDouble,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  Moon,
  TrendingUp,
  DoorOpen,
} from "lucide-react";
import { toast } from "sonner";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useBranches } from "@/hooks/useBranches";
import { useCalendar } from "@/hooks/useCalendar";
import { useSettleDebt } from "@/hooks/useDebtors";
import { MonthlyReport, Room } from "@/types";
import { getErrorMessage } from "@/lib/api";
import { cn, formatDate, formatMoney, nightsBetween, reportDebt, paymentStatusClass } from "@/lib/utils";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const CELL_W = 46;
const ROW_H = 42;
const LABEL_W = 148;
const DAY_MS = 24 * 60 * 60 * 1000;

const statusBar: Record<string, string> = {
  Оплачено: "from-emerald-400 to-emerald-500 text-emerald-950",
  Частично: "from-amber-400 to-amber-500 text-amber-950",
  Долг: "from-rose-400 to-rose-500 text-rose-950",
};

const statusFilters = [
  { key: "Оплачено", label: "Оплачено", dot: "bg-emerald-500" },
  { key: "Частично", label: "Частично", dot: "bg-amber-500" },
  { key: "Долг", label: "Долг", dot: "bg-rose-500" },
] as const;

function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayStartMs(d: string | Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Heatmap classes for the occupancy % cell. */
function heat(pct: number): string {
  if (pct === 0) return "text-muted-foreground/60";
  if (pct < 40) return "bg-emerald-500/10 text-emerald-600";
  if (pct < 70) return "bg-amber-500/15 text-amber-600";
  if (pct < 90) return "bg-orange-500/20 text-orange-600";
  return "bg-rose-500/25 text-rose-600";
}

interface Group {
  type: string;
  rooms: Room[];
}

export default function CalendarPage() {
  const { data: branches } = useBranches();
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selected, setSelected] = useState<MonthlyReport | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hover, setHover] = useState<{ b: MonthlyReport; x: number; y: number } | null>(null);

  const effectiveBranchId = branchId ?? branches?.[0]?.id;

  const monthStart = new Date(cursor.year, cursor.month, 1);
  const monthEnd = new Date(cursor.year, cursor.month + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const monthStartMs = dayStartMs(monthStart);

  const { data, isLoading } = useCalendar(effectiveBranchId, isoDay(monthStart), isoDay(monthEnd));
  const settle = useSettleDebt();

  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.year, cursor.month, i + 1)),
    [cursor.year, cursor.month, daysInMonth]
  );

  const todayIndex = useMemo(() => {
    const t = new Date();
    return t.getFullYear() === cursor.year && t.getMonth() === cursor.month ? t.getDate() - 1 : -1;
  }, [cursor.year, cursor.month]);

  const dayIndex = (d: string | Date) => Math.round((dayStartMs(d) - monthStartMs) / DAY_MS);

  const groups: Group[] = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, Room[]>();
    for (const room of data.rooms) {
      const key = room.type?.trim() || "Без типа";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(room);
    }
    return Array.from(map, ([type, rooms]) => ({ type, rooms }));
  }, [data]);

  const occupiedByDay = useMemo(() => {
    const arr: Set<string>[] = Array.from({ length: daysInMonth }, () => new Set<string>());
    if (!data) return arr;
    for (const b of data.bookings) {
      const start = dayIndex(b.date);
      const end = b.checkOut ? dayIndex(b.checkOut) : start + 1;
      for (let d = Math.max(0, start); d < Math.min(daysInMonth, end); d++) arr[d].add(b.roomId);
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, daysInMonth, monthStartMs]);

  const totalRooms = data?.rooms.length ?? 0;

  const bookingsByRoom = useMemo(() => {
    const map = new Map<string, MonthlyReport[]>();
    if (!data) return map;
    for (const b of data.bookings) {
      if (!map.has(b.roomId)) map.set(b.roomId, []);
      map.get(b.roomId)!.push(b);
    }
    return map;
  }, [data]);

  // Quick stats strip.
  const stats = useMemo(() => {
    const occToday = todayIndex >= 0 ? occupiedByDay[todayIndex].size : 0;
    const occPctToday = totalRooms && todayIndex >= 0 ? Math.round((occToday / totalRooms) * 100) : 0;
    const avg =
      totalRooms && daysInMonth
        ? Math.round(
            (occupiedByDay.reduce((s, set) => s + set.size, 0) / (totalRooms * daysInMonth)) * 100
          )
        : 0;
    return {
      occPctToday,
      freeToday: todayIndex >= 0 ? totalRooms - occToday : null,
      bookings: data?.bookings.length ?? 0,
      avg,
    };
  }, [occupiedByDay, totalRooms, todayIndex, daysInMonth, data]);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function goToday() {
    const n = new Date();
    setCursor({ year: n.getFullYear(), month: n.getMonth() });
  }

  async function handleSettle() {
    if (!selected) return;
    try {
      await settle.mutateAsync(selected.id);
      toast.success("Долг погашен");
      setSelected(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const q = search.trim().toLowerCase();
  function matches(b: MonthlyReport) {
    if (statusFilter && b.paymentStatus !== statusFilter) return false;
    if (q) {
      const hay = `${b.guestName ?? ""} ${b.room.roomNumber} ${b.source.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }
  const filterActive = Boolean(statusFilter || q);

  const gridWidth = LABEL_W + daysInMonth * CELL_W;

  const statCards = [
    { label: "Загрузка сегодня", value: `${stats.occPctToday}%`, icon: TrendingUp, tint: "bg-indigo-50 text-indigo-600" },
    {
      label: "Свободно сегодня",
      value: stats.freeToday === null ? "—" : String(stats.freeToday),
      icon: DoorOpen,
      tint: "bg-emerald-50 text-emerald-600",
    },
    { label: "Броней в месяце", value: String(stats.bookings), icon: CalendarDays, tint: "bg-sky-50 text-sky-600" },
    { label: "Средняя загрузка", value: `${stats.avg}%`, icon: Moon, tint: "bg-violet-50 text-violet-600" },
  ];

  return (
    <div>
      <PageHeader title="Шахматка" description="Загрузка номеров по датам заезда и выезда." />

      {/* Панель управления */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end justify-between gap-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-52 space-y-1.5">
              <Label>Филиал</Label>
              <Select value={effectiveBranchId ?? ""} onValueChange={(v) => setBranchId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите филиал" />
                </SelectTrigger>
                <SelectContent>
                  {(branches ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-56 space-y-1.5">
              <Label>Поиск</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Гость, номер, источник…"
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToday}>
              Сегодня
            </Button>
            <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[150px] text-center text-sm font-semibold text-foreground">
              {MONTHS[cursor.month]} {cursor.year}
            </span>
            <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Быстрые показатели */}
      {effectiveBranchId && data && data.rooms.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((c) => (
            <Card key={c.label}>
              <CardContent className="flex items-center gap-3 p-3.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.tint}`}>
                  <c.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-lg font-semibold leading-tight text-foreground">{c.value}</div>
                  <p className="text-[11px] text-muted-foreground">{c.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Легенда + фильтр по статусу */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusFilters.map((s) => {
          const active = statusFilter === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setStatusFilter(active ? null : s.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} />
              {s.label}
            </button>
          );
        })}
        {filterActive && (
          <button
            onClick={() => {
              setStatusFilter(null);
              setSearch("");
            }}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Сбросить
          </button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !effectiveBranchId ? (
        <EmptyState icon={CalendarDays} title="Выберите филиал" description="Шахматка покажет загрузку его номеров." />
      ) : !data || data.rooms.length === 0 ? (
        <EmptyState icon={BedDouble} title="Нет номеров" description="В этом филиале ещё нет номеров." />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="overflow-x-auto p-0">
            <div style={{ width: gridWidth }} className="relative text-xs">
              {/* Заголовок: дни + загрузка % (sticky) */}
              <div className="sticky top-0 z-30 flex border-b border-border bg-card/95 backdrop-blur">
                <div
                  className="sticky left-0 z-40 flex items-center bg-card px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ width: LABEL_W, minWidth: LABEL_W }}
                >
                  Загрузка
                </div>
                {days.map((d, i) => {
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  const occ = totalRooms ? Math.round((occupiedByDay[i].size / totalRooms) * 100) : 0;
                  return (
                    <div
                      key={i}
                      style={{ width: CELL_W, minWidth: CELL_W }}
                      className={cn(
                        "relative border-l border-border/70 pb-1 pt-1.5 text-center",
                        i === todayIndex && "bg-primary/10",
                        weekend && i !== todayIndex && "bg-muted/40"
                      )}
                    >
                      {i === todayIndex && <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
                      <div className={cn("text-[10px]", weekend ? "text-rose-400" : "text-muted-foreground")}>
                        {WEEKDAYS[d.getDay()]}
                      </div>
                      <div className={cn("text-sm font-semibold", i === todayIndex ? "text-primary" : "text-foreground")}>
                        {d.getDate()}
                      </div>
                      <div className={cn("mx-1 mt-1 rounded py-0.5 text-[9px] font-semibold", heat(occ))}>{occ}%</div>
                    </div>
                  );
                })}
              </div>

              {/* Группы по типам */}
              {groups.map((g) => (
                <div key={g.type}>
                  <div className="flex border-b border-border bg-secondary/50">
                    <div
                      className="sticky left-0 z-20 flex items-center gap-2 bg-secondary/50 px-3 py-1.5 font-semibold text-foreground"
                      style={{ width: LABEL_W, minWidth: LABEL_W }}
                    >
                      <span className="h-3 w-1 rounded-full bg-primary/60" />
                      {g.type} · {g.rooms.length}
                    </div>
                    {days.map((d, i) => {
                      const occInGroup = g.rooms.filter((r) => occupiedByDay[i].has(r.id)).length;
                      const free = g.rooms.length - occInGroup;
                      return (
                        <div
                          key={i}
                          style={{ width: CELL_W, minWidth: CELL_W }}
                          className={cn(
                            "border-l border-border/70 py-1.5 text-center text-[11px] font-medium",
                            i === todayIndex && "bg-primary/10",
                            free === 0 ? "text-rose-500" : "text-muted-foreground"
                          )}
                        >
                          {free}
                        </div>
                      );
                    })}
                  </div>

                  {g.rooms.map((room, ri) => (
                    <div
                      key={room.id}
                      className={cn(
                        "group flex border-b border-border transition-colors hover:bg-primary/[0.03]",
                        ri % 2 === 1 && "bg-muted/20"
                      )}
                      style={{ height: ROW_H }}
                    >
                      <div
                        className="sticky left-0 z-20 flex items-center bg-card px-3 font-medium text-foreground transition-colors group-hover:bg-primary/[0.03]"
                        style={{ width: LABEL_W, minWidth: LABEL_W }}
                      >
                        {room.roomNumber}
                        {room.type && (
                          <span className="ml-2 truncate text-[10px] font-normal text-muted-foreground">
                            {room.type}
                          </span>
                        )}
                      </div>
                      <div className="relative" style={{ width: daysInMonth * CELL_W, height: ROW_H }}>
                        {/* фон-сетка */}
                        <div className="absolute inset-0 flex">
                          {days.map((d, i) => {
                            const weekend = d.getDay() === 0 || d.getDay() === 6;
                            return (
                              <div
                                key={i}
                                style={{ width: CELL_W, minWidth: CELL_W }}
                                className={cn(
                                  "border-l border-border/40",
                                  i === todayIndex && "bg-primary/[0.07]",
                                  weekend && i !== todayIndex && "bg-muted/25"
                                )}
                              />
                            );
                          })}
                        </div>
                        {/* брони */}
                        {(bookingsByRoom.get(room.id) ?? []).map((b) => (
                          <BookingBar
                            key={b.id}
                            booking={b}
                            checkInIdx={dayIndex(b.date)}
                            checkOutIdx={b.checkOut ? dayIndex(b.checkOut) : dayIndex(b.date) + 1}
                            daysInMonth={daysInMonth}
                            dimmed={filterActive && !matches(b)}
                            onClick={() => setSelected(b)}
                            onHover={(x, y) => setHover({ b, x, y })}
                            onLeave={() => setHover(null)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Плавающая подсказка */}
      {hover && <HoverCard booking={hover.b} x={hover.x} y={hover.y} />}

      {/* Детали брони */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.guestName || "Бронь"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <Row label="Номер" value={`${selected.room.roomNumber}${selected.room.type ? ` · ${selected.room.type}` : ""}`} />
                <Row
                  label="Период"
                  value={`${formatDate(selected.date)} → ${selected.checkOut ? formatDate(selected.checkOut) : "+1"} · ${nightsBetween(selected.date, selected.checkOut)} ноч.`}
                />
                <Row label="Источник" value={selected.source.name} />
                <Row label="Администратор" value={selected.admin.fullName} />
                <Row label="Цена" value={formatMoney(selected.price, selected.currency)} />
                <Row label="Оплата" value={selected.paymentMethod} />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Статус</span>
                  <Badge className={paymentStatusClass(selected.paymentStatus)}>{selected.paymentStatus}</Badge>
                </div>
                {reportDebt(selected) > 0 && (
                  <Row label="Долг" value={formatMoney(reportDebt(selected), selected.currency)} valueClass="text-destructive font-semibold" />
                )}
              </div>
              <DialogFooter>
                {reportDebt(selected) > 0 && (
                  <Button onClick={handleSettle} disabled={settle.isPending}>
                    <CheckCircle2 className="h-4 w-4" /> Погасить долг
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Закрыть
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right text-foreground", valueClass)}>{value}</span>
    </div>
  );
}

function HoverCard({ booking, x, y }: { booking: MonthlyReport; x: number; y: number }) {
  // Clamp so the card stays within the viewport.
  const W = 264;
  const left = Math.min(x + 16, window.innerWidth - W - 12);
  const top = Math.min(y + 16, window.innerHeight - 190);
  const debt = reportDebt(booking);
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-xl border border-border bg-card p-3 text-xs shadow-xl animate-fade-in"
      style={{ left, top, width: W }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-foreground">{booking.guestName || "Без имени"}</span>
        <Badge className={paymentStatusClass(booking.paymentStatus)}>{booking.paymentStatus}</Badge>
      </div>
      <div className="space-y-1 text-muted-foreground">
        <div className="flex justify-between gap-3">
          <span>Номер</span>
          <span className="text-foreground">
            {booking.room.roomNumber}
            {booking.room.type ? ` · ${booking.room.type}` : ""}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Период</span>
          <span className="text-right text-foreground">
            {formatDate(booking.date)} → {booking.checkOut ? formatDate(booking.checkOut) : "+1"} ·{" "}
            {nightsBetween(booking.date, booking.checkOut)} ноч.
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Источник</span>
          <span className="text-foreground">{booking.source.name}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Цена</span>
          <span className="font-medium text-foreground">{formatMoney(booking.price, booking.currency)}</span>
        </div>
        {debt > 0 && (
          <div className="flex justify-between gap-3">
            <span>Долг</span>
            <span className="font-semibold text-destructive">{formatMoney(debt, booking.currency)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BookingBar({
  booking,
  checkInIdx,
  checkOutIdx,
  daysInMonth,
  dimmed,
  onClick,
  onHover,
  onLeave,
}: {
  booking: MonthlyReport;
  checkInIdx: number;
  checkOutIdx: number;
  daysInMonth: number;
  dimmed: boolean;
  onClick: () => void;
  onHover: (x: number, y: number) => void;
  onLeave: () => void;
}) {
  // Bar spans from mid check-in cell to mid check-out cell (half-day convention),
  // clipped to the visible month so multi-month stays don't overflow.
  const rawStart = checkInIdx + 0.5;
  const rawEnd = checkOutIdx + 0.5;
  const startUnit = Math.max(0, rawStart);
  const endUnit = Math.min(daysInMonth, rawEnd);
  if (endUnit <= startUnit) return null;

  // Rounded only where the real check-in / check-out is visible in this month.
  const roundLeft = rawStart >= 0;
  const roundRight = rawEnd <= daysInMonth;

  const left = startUnit * CELL_W + 2;
  const width = (endUnit - startUnit) * CELL_W - 4;

  const debt = reportDebt(booking);
  const label = booking.guestName || booking.source.name;
  const wide = width > 64;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => onHover(e.clientX, e.clientY)}
      onMouseMove={(e) => onHover(e.clientX, e.clientY)}
      onMouseLeave={onLeave}
      className={cn(
        "absolute flex items-center gap-1.5 overflow-hidden whitespace-nowrap bg-gradient-to-b px-2.5 text-[11px] font-semibold shadow-sm ring-1 ring-black/5 transition-[transform,box-shadow] duration-150 hover:z-30 hover:-translate-y-px hover:shadow-md",
        statusBar[booking.paymentStatus] ?? "from-secondary to-secondary text-foreground",
        dimmed && "opacity-20 grayscale"
      )}
      style={{
        left,
        width,
        top: 5,
        height: ROW_H - 10,
        borderTopLeftRadius: roundLeft ? 8 : 2,
        borderBottomLeftRadius: roundLeft ? 8 : 2,
        borderTopRightRadius: roundRight ? 8 : 2,
        borderBottomRightRadius: roundRight ? 8 : 2,
      }}
    >
      {/* долг — диагональная штриховка поверх */}
      {debt > 0 && (
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(0,0,0,0.14) 0 5px, transparent 5px 10px)",
          }}
        />
      )}
      <span className="relative truncate">{label}</span>
      {wide && (
        <span className="relative ml-auto shrink-0 font-medium opacity-80">
          {Math.round(booking.price / 1000)}к
        </span>
      )}
      {debt > 0 && <AlertCircle className="relative h-3 w-3 shrink-0" />}
    </button>
  );
}
