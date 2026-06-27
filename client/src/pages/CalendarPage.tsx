import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, BedDouble } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useBranches } from "@/hooks/useBranches";
import { useCalendar } from "@/hooks/useCalendar";
import { MonthlyReport } from "@/types";
import { cn, formatMoney, nightsBetween } from "@/lib/utils";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const statusBar: Record<string, string> = {
  Оплачено: "bg-emerald-400/80 text-emerald-950",
  Частично: "bg-amber-400/80 text-amber-950",
  Долг: "bg-red-400/80 text-red-950",
};

/** Local midnight for a booking's start/end day. */
function dayStart(d: string | Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export default function CalendarPage() {
  const { data: branches } = useBranches();
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  // Default to the first branch once loaded.
  const effectiveBranchId = branchId ?? branches?.[0]?.id;

  const monthStart = new Date(cursor.year, cursor.month, 1);
  const monthEnd = new Date(cursor.year, cursor.month + 1, 0);
  const daysInMonth = monthEnd.getDate();

  const { data, isLoading } = useCalendar(effectiveBranchId, isoDay(monthStart), isoDay(monthEnd));

  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.year, cursor.month, i + 1)),
    [cursor.year, cursor.month, daysInMonth]
  );

  // For each room, map a day index -> the booking covering it.
  const byRoom = useMemo(() => {
    const map: Record<string, (MonthlyReport | undefined)[]> = {};
    if (!data) return map;
    for (const room of data.rooms) map[room.id] = new Array(daysInMonth).fill(undefined);
    for (const b of data.bookings) {
      const start = dayStart(b.date);
      const end = b.checkOut ? dayStart(b.checkOut) : start + 24 * 60 * 60 * 1000;
      const arr = map[b.roomId];
      if (!arr) continue;
      for (let i = 0; i < daysInMonth; i++) {
        const t = dayStart(days[i]);
        if (t >= start && t < end) arr[i] = b;
      }
    }
    return map;
  }, [data, days, daysInMonth]);

  const occupiedNights = data
    ? data.bookings.reduce((sum, b) => sum + nightsBetween(b.date, b.checkOut), 0)
    : 0;

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div>
      <PageHeader
        title="Календарь загрузки"
        description="Занятость номеров по датам заезда и выезда."
      />

      <Card className="mb-6">
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

      {/* Легенда */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-emerald-400/80" /> Оплачено
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-amber-400/80" /> Частично
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-red-400/80" /> Долг
        </span>
        {data && <span className="ml-auto">Занято ночей за месяц: {occupiedNights}</span>}
      </div>

      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : !effectiveBranchId ? (
        <EmptyState icon={CalendarDays} title="Выберите филиал" description="Календарь покажет загрузку его номеров." />
      ) : !data || data.rooms.length === 0 ? (
        <EmptyState icon={BedDouble} title="Нет номеров" description="В этом филиале ещё нет номеров." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <div
              className="min-w-max"
              style={{ display: "grid", gridTemplateColumns: `8rem repeat(${daysInMonth}, 2rem)` }}
            >
              {/* Header */}
              <div className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
                Номер
              </div>
              {days.map((d) => {
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={d.getTime()}
                    className={cn(
                      "border-b border-border py-2 text-center text-[11px]",
                      weekend ? "bg-muted text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {d.getDate()}
                  </div>
                );
              })}

              {/* Rows */}
              {data.rooms.map((room) => (
                <Row key={room.id} roomNumber={room.roomNumber} cells={byRoom[room.id] ?? []} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ roomNumber, cells }: { roomNumber: string; cells: (MonthlyReport | undefined)[] }) {
  return (
    <>
      <div className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-2 text-sm font-medium text-foreground">
        {roomNumber}
      </div>
      {cells.map((booking, i) => {
        const prev = cells[i - 1];
        const next = cells[i + 1];
        const sameAsPrev = prev && prev.id === booking?.id;
        const sameAsNext = next && next.id === booking?.id;
        return (
          <div key={i} className="border-b border-border p-0.5">
            {booking ? (
              <div
                title={`${booking.room.roomNumber} · ${formatMoney(booking.price, booking.currency)} · ${booking.source.name} · ${booking.paymentStatus}`}
                className={cn(
                  "flex h-6 items-center justify-center text-[10px] font-medium",
                  statusBar[booking.paymentStatus] ?? "bg-secondary",
                  sameAsPrev ? "rounded-l-none" : "rounded-l-md",
                  sameAsNext ? "rounded-r-none" : "rounded-r-md"
                )}
              >
                {!sameAsPrev && "●"}
              </div>
            ) : (
              <div className="h-6" />
            )}
          </div>
        );
      })}
    </>
  );
}
