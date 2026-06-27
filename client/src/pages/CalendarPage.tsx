import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, BedDouble, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const CELL_W = 40;
const ROW_H = 34;
const LABEL_W = 132;
const DAY_MS = 24 * 60 * 60 * 1000;
const ANGLE = 7;

const statusColor: Record<string, string> = {
  Оплачено: "bg-emerald-400/85 text-emerald-950",
  Частично: "bg-amber-400/90 text-amber-950",
  Долг: "bg-red-400/85 text-red-950",
};

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

  // Group rooms by type (preserving load order).
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

  // Per-day set of occupied room ids (a night is occupied if checkIn ≤ day < checkOut).
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

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
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

  const gridWidth = LABEL_W + daysInMonth * CELL_W;

  return (
    <div>
      <PageHeader title="Шахматка" description="Загрузка номеров по датам заезда и выезда." />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end justify-between gap-3 p-4">
          <div className="w-56 space-y-1.5">
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

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setCursor(() => {
              const n = new Date();
              return { year: n.getFullYear(), month: n.getMonth() };
            })}>
              Сегодня
            </Button>
            <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[150px] text-center text-sm font-medium text-foreground">
              {MONTHS[cursor.month]} {cursor.year}
            </span>
            <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-400/85" /> Оплачено</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-400/90" /> Частично</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-400/85" /> Долг</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> есть долг</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !effectiveBranchId ? (
        <EmptyState icon={CalendarDays} title="Выберите филиал" description="Шахматка покажет загрузку его номеров." />
      ) : !data || data.rooms.length === 0 ? (
        <EmptyState icon={BedDouble} title="Нет номеров" description="В этом филиале ещё нет номеров." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <div style={{ width: gridWidth }} className="text-xs">
              {/* Заголовок: дни + загрузка % */}
              <div className="flex border-b border-border bg-muted/40">
                <div
                  className="sticky left-0 z-20 flex items-center bg-card px-3 font-medium text-muted-foreground"
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
                        "border-l border-border py-1 text-center",
                        i === todayIndex && "bg-primary/10",
                        weekend && i !== todayIndex && "bg-muted"
                      )}
                    >
                      <div className="text-[10px] text-muted-foreground">{WEEKDAYS[d.getDay()]}</div>
                      <div className={cn("font-medium", i === todayIndex ? "text-primary" : "text-foreground")}>
                        {d.getDate()}
                      </div>
                      <div className={cn("text-[9px]", occ >= 90 ? "text-red-500" : "text-muted-foreground")}>
                        {occ}%
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Группы по типам */}
              {groups.map((g) => (
                <div key={g.type}>
                  <div className="flex border-b border-border bg-secondary/60">
                    <div
                      className="sticky left-0 z-20 flex items-center bg-secondary/60 px-3 py-1 font-semibold text-foreground"
                      style={{ width: LABEL_W, minWidth: LABEL_W }}
                    >
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
                            "border-l border-border py-1 text-center text-[11px]",
                            i === todayIndex && "bg-primary/10",
                            free === 0 ? "text-red-500" : "text-muted-foreground"
                          )}
                        >
                          {free}
                        </div>
                      );
                    })}
                  </div>

                  {g.rooms.map((room) => (
                    <div key={room.id} className="flex border-b border-border" style={{ height: ROW_H }}>
                      <div
                        className="sticky left-0 z-20 flex items-center bg-card px-3 font-medium text-foreground"
                        style={{ width: LABEL_W, minWidth: LABEL_W }}
                      >
                        {room.roomNumber}
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
                                  "border-l border-border/70",
                                  i === todayIndex && "bg-primary/5",
                                  weekend && i !== todayIndex && "bg-muted/50"
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
                            onClick={() => setSelected(b)}
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

function BookingBar({
  booking,
  checkInIdx,
  checkOutIdx,
  daysInMonth,
  onClick,
}: {
  booking: MonthlyReport;
  checkInIdx: number;
  checkOutIdx: number;
  daysInMonth: number;
  onClick: () => void;
}) {
  // Bar spans from mid check-in cell to mid check-out cell, clipped to the month.
  const rawStart = checkInIdx + 0.5;
  const rawEnd = checkOutIdx + 0.5;
  const startUnit = Math.max(0, rawStart);
  const endUnit = Math.min(daysInMonth, rawEnd);
  if (endUnit <= startUnit) return null;

  const left = startUnit * CELL_W;
  const width = (endUnit - startUnit) * CELL_W;

  const leftAngled = rawStart >= 0; // настоящий заезд виден
  const rightAngled = rawEnd <= daysInMonth; // настоящий выезд виден

  const tl = leftAngled ? `${ANGLE}px` : "0";
  const br = rightAngled ? `calc(100% - ${ANGLE}px)` : "100%";
  const clipPath = `polygon(${tl} 0, 100% 0, ${br} 100%, 0 100%)`;

  const debt = reportDebt(booking);
  const label = booking.guestName || booking.source.name;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} · ${formatMoney(booking.price, booking.currency)} · ${booking.paymentStatus}`}
      className={cn(
        "absolute flex items-center gap-1 overflow-hidden whitespace-nowrap px-2.5 text-[11px] font-medium shadow-sm transition-transform hover:brightness-95",
        statusColor[booking.paymentStatus] ?? "bg-secondary text-foreground"
      )}
      style={{ left, width, top: 4, height: ROW_H - 8, clipPath }}
    >
      <span className="truncate">{label}</span>
      {debt > 0 && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-red-600" />}
    </button>
  );
}
