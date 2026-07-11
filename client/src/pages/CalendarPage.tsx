import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  BedDouble,
  Search,
  X,
  TrendingUp,
  DoorOpen,
  MousePointerClick,
  LogIn,
  LogOut,
  Plus,
  Wallet,
  Gauge,
  Maximize,
  Minimize,
} from "lucide-react";
import { toast } from "sonner";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import ReservationCard from "@/components/ReservationCard";
import ReservationModal from "@/components/ReservationModal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import BookingDialog, { BookingDraft } from "@/components/BookingDialog";
import BookingWizard from "@/components/BookingWizard";
import { useBranches, useMyBranches } from "@/hooks/useBranches";
import { useAuth } from "@/contexts/AuthContext";
import { useCalendar } from "@/hooks/useCalendar";
import { useUpdateReport, useDeleteReport } from "@/hooks/useReports";
import { STATUS_META, STATUS_DOT_CLASS, holdsRoom } from "@/lib/bookingStatus";
import { MonthlyReport, Room, BookingStatus, bookingStatuses } from "@/types";
import { getErrorMessage } from "@/lib/api";
import { cn, formatDate, formatMoney, nightsBetween, pluralRu, reportDebt, paymentStatusClass } from "@/lib/utils";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const CELL_W = 46;
const ROW_H = 42;
const LABEL_W = 148;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Status filter chips — driven by the same status metadata every other page uses. */
const STATUS_FILTERS = bookingStatuses.map((status) => ({ status, ...STATUS_META[status] }));

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
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const isMultiBranchAdmin = isAdmin && (user?.branchIds?.length ?? 0) > 1;
  const { data: branches } = useBranches({ enabled: !isAdmin });
  const { data: myBranches } = useMyBranches({ enabled: isMultiBranchAdmin });
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      rootRef.current?.requestFullscreen();
    }
  }
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selected, setSelected] = useState<MonthlyReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MonthlyReport | null>(null);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | null>(null);
  const [search, setSearch] = useState("");
  const [hover, setHover] = useState<{ b: MonthlyReport; x: number; y: number } | null>(null);
  const [freeHover, setFreeHover] = useState<{ room: Room; day: Date; x: number; y: number } | null>(null);
  const deleteReport = useDeleteReport();
  // Drag-to-select on the grid → new booking.
  const [drag, setDrag] = useState<{ roomId: string; a: number; b: number } | null>(null);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [editing, setEditing] = useState<MonthlyReport | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  // Drag an existing booking to move / resize it.
  const [move, setMove] = useState<{
    booking: MonthlyReport;
    mode: "move" | "resize";
    origStart: number;
    origEnd: number;
    gridLeft: number;
    pointerStartDay: number;
    curStart: number;
    curEnd: number;
    targetRoomId: string;
  } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const updateReport = useUpdateReport();

  const effectiveBranchId = isMultiBranchAdmin
    ? branchId ?? user?.branchId ?? myBranches?.[0]?.id
    : isAdmin
      ? user?.branchId ?? undefined
      : branchId ?? branches?.[0]?.id;

  const monthStart = new Date(cursor.year, cursor.month, 1);
  const monthEnd = new Date(cursor.year, cursor.month + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const monthStartMs = dayStartMs(monthStart);

  const { data, isLoading } = useCalendar(effectiveBranchId, isoDay(monthStart), isoDay(monthEnd));

  // The modal must reflect live query data, not the click-time snapshot in
  // `selected` — otherwise a status change made from inside the modal (via
  // ReservationActions) would leave the open modal showing the stale status
  // even though the mutation succeeded and the chessboard behind it updated.
  const selectedReport = selected ? data?.bookings.find((b) => b.id === selected.id) ?? selected : null;

  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.year, cursor.month, i + 1)),
    [cursor.year, cursor.month, daysInMonth]
  );

  const todayIndex = useMemo(() => {
    const t = new Date();
    return t.getFullYear() === cursor.year && t.getMonth() === cursor.month ? t.getDate() - 1 : -1;
  }, [cursor.year, cursor.month]);

  const dayIndex = (d: string | Date) => Math.round((dayStartMs(d) - monthStartMs) / DAY_MS);

  // Keep a ref of the live drag so the global mouseup handler always sees it.
  const dragRef = useRef(drag);
  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  // Finalize a drag-selection on mouse release anywhere → open the create dialog.
  useEffect(() => {
    function finish() {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      setDrag(null);
      const a = Math.min(d.a, d.b);
      const b = Math.max(d.a, d.b);
      if (!rangeFree(d.roomId, a, b + 1)) {
        toast.error("Номер занят на выбранные даты");
        return;
      }
      const checkOut = new Date(days[b]);
      checkOut.setDate(checkOut.getDate() + 1);
      setEditing(null);
      setDraft({ roomId: d.roomId, date: isoDay(days[a]), checkOut: isoDay(checkOut) });
      setBookingOpen(true);
    }
    window.addEventListener("mouseup", finish);
    return () => window.removeEventListener("mouseup", finish);
  }, [days]);

  // Esc cancels an in-progress selection or drag-move without side effects.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (dragRef.current) {
        dragRef.current = null;
        setDrag(null);
      }
      if (moveRef.current) {
        moveRef.current = null;
        setMove(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
      if (!holdsRoom(b.status)) continue; // cancellations / no-shows don't occupy nights
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

  // Ref so global drag handlers always see the latest bookings.
  const bookingsRef = useRef(bookingsByRoom);
  useEffect(() => {
    bookingsRef.current = bookingsByRoom;
  });

  const spanOf = (b: MonthlyReport): [number, number] => {
    const s = dayIndex(b.date);
    return [s, b.checkOut ? dayIndex(b.checkOut) : s + 1];
  };

  /** Is [start, end) free in this room (ignoring one booking by id)? */
  function rangeFree(roomId: string, start: number, end: number, ignoreId?: string) {
    const list = bookingsRef.current.get(roomId) ?? [];
    return !list.some((b) => {
      if (ignoreId && b.id === ignoreId) return false;
      if (!holdsRoom(b.status)) return false; // mirrors the server: cancelled/no-show don't block
      const [s, e] = spanOf(b);
      return start < e && s < end;
    });
  }

  /** Convert a month-relative day index (may be negative) to an ISO date. */
  const idxToIso = (idx: number) => isoDay(new Date(cursor.year, cursor.month, 1 + idx));

  // Live drag-move / resize of an existing booking.
  const moveRef = useRef(move);
  useEffect(() => {
    moveRef.current = move;
  }, [move]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const m = moveRef.current;
      if (!m) return;
      const day = Math.floor((e.clientX - m.gridLeft) / CELL_W);
      const delta = day - m.pointerStartDay;
      let curStart = m.origStart;
      let curEnd = m.origEnd;
      let targetRoomId = m.targetRoomId;
      if (m.mode === "move") {
        curStart = m.origStart + delta;
        curEnd = m.origEnd + delta;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const rowEl = el?.closest("[data-room-row]") as HTMLElement | null;
        if (rowEl?.dataset.roomId) targetRoomId = rowEl.dataset.roomId;
      } else {
        curEnd = Math.max(m.origStart + 1, m.origEnd + delta);
      }
      if (curStart !== m.curStart || curEnd !== m.curEnd || targetRoomId !== m.targetRoomId)
        setMove({ ...m, curStart, curEnd, targetRoomId });
    }
    async function onMouseUp() {
      const m = moveRef.current;
      if (!m) return;
      setMove(null);
      const roomChanged = m.targetRoomId !== m.booking.roomId;
      // No movement → it was a click → open details.
      if (!roomChanged && m.curStart === m.origStart && m.curEnd === m.origEnd) {
        setSelected(m.booking);
        return;
      }
      if (!rangeFree(m.targetRoomId, m.curStart, m.curEnd, m.booking.id)) {
        toast.error("Пересекается с другой бронью");
        return;
      }
      const b = m.booking;
      try {
        await updateReport.mutateAsync({
          id: b.id,
          data: {
            date: idxToIso(m.curStart),
            checkOut: idxToIso(m.curEnd),
            guestName: b.guestName ?? "",
            branchId: b.branchId,
            adminId: b.adminId,
            roomId: m.targetRoomId,
            sourceId: b.sourceId,
            price: b.price,
            currency: b.currency,
            paymentMethod: b.paymentMethod,
            paymentStatus: b.paymentStatus,
            paidAmount: b.paidAmount ?? undefined,
            notes: b.notes ?? "",
          },
        });
        toast.success(roomChanged ? "Бронь перенесена в другой номер" : m.mode === "resize" ? "Срок брони изменён" : "Бронь перенесена");
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.year, cursor.month, monthStartMs]);

  function startMove(e: React.MouseEvent, booking: MonthlyReport, mode: "move" | "resize") {
    e.stopPropagation();
    e.preventDefault();
    const gridEl = (e.currentTarget as HTMLElement).closest("[data-grid-row]") as HTMLElement | null;
    if (!gridEl) return;
    const gridLeft = gridEl.getBoundingClientRect().left;
    const [origStart, origEnd] = spanOf(booking);
    const pointerStartDay = Math.floor((e.clientX - gridLeft) / CELL_W);
    setMove({
      booking,
      mode,
      origStart,
      origEnd,
      gridLeft,
      pointerStartDay,
      curStart: origStart,
      curEnd: origEnd,
      targetRoomId: booking.roomId,
    });
  }

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
    let arrivals = 0;
    let departures = 0;
    let revenueToday = 0;
    for (const b of data?.bookings ?? []) {
      if (!holdsRoom(b.status)) continue;
      const [s, e] = [dayIndex(b.date), b.checkOut ? dayIndex(b.checkOut) : dayIndex(b.date) + 1];
      if (s === todayIndex) arrivals++;
      if (e === todayIndex) departures++;
      if (todayIndex >= s && todayIndex < e) revenueToday += b.price / Math.max(1, e - s);
    }
    return {
      occPctToday,
      freeToday: todayIndex >= 0 ? totalRooms - occToday : null,
      bookings: data?.bookings.length ?? 0,
      avg,
      arrivals,
      departures,
      revenueToday: Math.round(revenueToday),
      avgRate: occToday ? Math.round(revenueToday / occToday) : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteReport.mutateAsync(deleteTarget.id);
      toast.success("Бронь удалена");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const q = search.trim().toLowerCase();
  function matches(b: MonthlyReport) {
    if (statusFilter && b.status !== statusFilter) return false;
    if (q) {
      const hay = `${b.guestName ?? ""} ${b.room.roomNumber} ${b.source.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }
  const filterActive = Boolean(statusFilter || q);

  const gridWidth = LABEL_W + daysInMonth * CELL_W;

  const statCards = [
    { label: "Загрузка сейчас", value: `${stats.occPctToday}%`, icon: TrendingUp, tint: "tint-indigo" },
    { label: "Свободно", value: stats.freeToday === null ? "—" : String(stats.freeToday), icon: DoorOpen, tint: "tint-emerald" },
    { label: "Заезды сегодня", value: String(stats.arrivals), icon: LogIn, tint: "tint-sky" },
    { label: "Выезды сегодня", value: String(stats.departures), icon: LogOut, tint: "tint-slate" },
    { label: "Выручка сегодня", value: `${(stats.revenueToday / 1000).toFixed(0)}к`, icon: Wallet, tint: "tint-amber" },
    { label: "Средняя загрузка", value: `${stats.avg}%`, icon: Gauge, tint: "tint-violet" },
  ];

  function quickNewBooking() {
    if (!data?.rooms.length) return;
    const startIdx = Math.max(0, todayIndex);
    const checkOut = new Date(days[Math.min(startIdx + 1, daysInMonth - 1)] ?? days[startIdx]);
    setEditing(null);
    setDraft({ roomId: data.rooms[0].id, date: isoDay(days[startIdx]), checkOut: isoDay(checkOut) });
    setBookingOpen(true);
  }

  return (
    <div ref={rootRef} className={cn(isFullscreen && "h-screen overflow-y-auto bg-background p-4")}>
      <PageHeader title="Шахматка" description="Загрузка номеров по датам заезда и выезда." />

      {/* Тулбар */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            {(!isAdmin || isMultiBranchAdmin) && (
              <div className="w-48 space-y-1.5">
                <Label>Филиал</Label>
                <Select value={effectiveBranchId ?? ""} onValueChange={(v) => setBranchId(v)}>
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
            <div className="w-52 space-y-1.5">
              <Label>Поиск</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Гость, номер, источник…" className="pl-8" />
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/60 p-1">
              <button onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц" className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[120px] px-1 text-center text-[13px] font-semibold text-foreground">
                {MONTHS[cursor.month]} {cursor.year}
              </span>
              <button onClick={() => shiftMonth(1)} aria-label="Следующий месяц" className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={goToday}>
              Сегодня
            </Button>
            <Button variant="outline" size="sm" onClick={toggleFullscreen} aria-label="Полноэкранный режим">
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>

          <Button size="sm" onClick={quickNewBooking} disabled={!data?.rooms.length}>
            <Plus className="h-4 w-4" /> Новая бронь
          </Button>
        </div>
      </div>

      {/* Occupancy header */}
      {effectiveBranchId && data && data.rooms.length > 0 && (
        <Card className="mb-4">
          <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
            {statCards.map((c) => (
              <div key={c.label} className="flex items-center gap-3 p-4">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.tint}`}>
                  <c.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold leading-tight tabular-nums text-foreground">{c.value}</div>
                  <p className="truncate text-[11px] text-muted-foreground">{c.label}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Фильтр по статусу брони — matches the exact colors used on the chessboard */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((s) => {
            const active = statusFilter === s.status;
            return (
              <button
                key={s.status}
                onClick={() => setStatusFilter(active ? null : s.status)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT_CLASS[s.status])} />
                {s.label}
              </button>
            );
          })}
        </div>
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
        <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <MousePointerClick className="h-3.5 w-3.5" /> 1 клетка = 1 ночь · клик или протяжка по свободным дням — новая бронь
        </span>
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
              {/* Маркер текущего времени */}
              {todayIndex >= 0 && (
                <div
                  className="pointer-events-none absolute top-0 z-20 h-full w-px bg-primary/70"
                  style={{ left: LABEL_W + todayIndex * CELL_W + (new Date().getHours() / 24) * CELL_W }}
                >
                  <span className="absolute -left-[3px] -top-1 h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
              )}
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
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((prev) => {
                          const next = new Set(prev);
                          next.has(g.type) ? next.delete(g.type) : next.add(g.type);
                          return next;
                        })
                      }
                      className="sticky left-0 z-20 flex items-center gap-1.5 bg-secondary/50 px-3 py-1.5 font-semibold text-foreground transition-colors hover:bg-secondary"
                      style={{ width: LABEL_W, minWidth: LABEL_W }}
                    >
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                          !collapsed.has(g.type) && "rotate-90"
                        )}
                      />
                      {g.type} · {g.rooms.length}
                    </button>
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

                  {!collapsed.has(g.type) && g.rooms.map((room, ri) => (
                    <div
                      key={room.id}
                      data-room-row
                      data-room-id={room.id}
                      className={cn(
                        "group flex border-b border-border transition-colors hover:bg-primary/[0.03]",
                        ri % 2 === 1 && "bg-muted/20",
                        move && move.targetRoomId === room.id && move.targetRoomId !== move.booking.roomId && "bg-primary/10"
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
                      <div
                        data-grid-row
                        className="relative select-none"
                        style={{ width: daysInMonth * CELL_W, height: ROW_H }}
                      >
                        {/* фон-сетка (кликабельная для создания брони) */}
                        <div className="absolute inset-0 flex">
                          {days.map((d, i) => {
                            const weekend = d.getDay() === 0 || d.getDay() === 6;
                            const free = !occupiedByDay[i].has(room.id);
                            return (
                              <div
                                key={i}
                                style={{ width: CELL_W, minWidth: CELL_W }}
                                onMouseDown={() => {
                                  const next = { roomId: room.id, a: i, b: i };
                                  dragRef.current = next;
                                  setDrag(next);
                                }}
                                onMouseEnter={(e) => {
                                  setDrag((dr) => {
                                    if (dr && dr.roomId === room.id) {
                                      const next = { ...dr, b: i };
                                      dragRef.current = next;
                                      return next;
                                    }
                                    return dr;
                                  });
                                  if (free && !dragRef.current && !moveRef.current) {
                                    setFreeHover({ room, day: d, x: e.clientX, y: e.clientY });
                                  }
                                }}
                                onMouseMove={(e) => {
                                  if (free && !dragRef.current && !moveRef.current) {
                                    setFreeHover({ room, day: d, x: e.clientX, y: e.clientY });
                                  }
                                }}
                                onMouseLeave={() => setFreeHover(null)}
                                className={cn(
                                  "cursor-pointer border-l border-border/40 transition-colors hover:bg-primary/10",
                                  i === todayIndex && "bg-primary/[0.07]",
                                  weekend && i !== todayIndex && "bg-muted/25"
                                )}
                              />
                            );
                          })}
                        </div>
                        {/* подсветка выделения при протяжке + живой счётчик ночей */}
                        {drag && drag.roomId === room.id && (
                          <div
                            className="pointer-events-none absolute z-30 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/15"
                            style={{
                              left: Math.min(drag.a, drag.b) * CELL_W + 1,
                              width: (Math.abs(drag.b - drag.a) + 1) * CELL_W - 2,
                              top: 4,
                              height: ROW_H - 8,
                            }}
                          >
                            <span className="whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                              {Math.abs(drag.b - drag.a) + 1}{" "}
                              {pluralRu(Math.abs(drag.b - drag.a) + 1, "ночь", "ночи", "ночей")}
                            </span>
                          </div>
                        )}
                        {/* брони; отменённые и незаезды скрыты (номер свободен) — видны только через фильтр статуса */}
                        {(bookingsByRoom.get(room.id) ?? [])
                          .filter((b) => holdsRoom(b.status) || statusFilter === b.status)
                          .filter((b) => !(move?.booking.id === b.id && move.targetRoomId !== room.id))
                          .map((b) => {
                            const beingMoved = move?.booking.id === b.id;
                            const [s0, e0] = spanOf(b);
                            return (
                              <ReservationCard
                                key={b.id}
                                booking={b}
                                checkInIdx={beingMoved ? move!.curStart : s0}
                                checkOutIdx={beingMoved ? move!.curEnd : e0}
                                daysInMonth={daysInMonth}
                                cellWidth={CELL_W}
                                dimmed={filterActive && !matches(b)}
                                dragging={beingMoved}
                                onMoveStart={(e, mode) => startMove(e, b, mode)}
                                onOpenDetails={() => setSelected(b)}
                                onHover={(x, y) => !moveRef.current && setHover({ b, x, y })}
                                onLeave={() => setHover(null)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setSelected(b);
                                }}
                              />
                            );
                          })}
                        {/* бронь, перетаскиваемая в этот номер из другого ряда */}
                        {move && move.targetRoomId === room.id && move.booking.roomId !== room.id && (
                          <ReservationCard
                            booking={move.booking}
                            checkInIdx={move.curStart}
                            checkOutIdx={move.curEnd}
                            daysInMonth={daysInMonth}
                            cellWidth={CELL_W}
                            dimmed={false}
                            dragging
                            onMoveStart={() => {}}
                            onOpenDetails={() => {}}
                            onHover={() => {}}
                            onLeave={() => {}}
                            onContextMenu={() => {}}
                          />
                        )}
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
      {hover && !move && !selected && <HoverCard booking={hover.b} x={hover.x} y={hover.y} />}

      {/* Превью свободной ячейки */}
      {freeHover && !move && !drag && !selected && <FreeCellCard {...freeHover} />}

      {/* Детали брони — единственное место, откуда выполняются все действия */}
      <ReservationModal
        report={selectedReport}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onEdit={(r) => {
          setEditing(r);
          setDraft(null);
          setBookingOpen(true);
          setSelected(null);
        }}
        onDeleteRequest={(r) => {
          setSelected(null);
          setDeleteTarget(r);
        }}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
        loading={deleteReport.isPending}
        title="Удалить бронь?"
        description="Эта бронь будет удалена без возможности восстановления."
      />

      {/* Редактирование существующей брони */}
      {effectiveBranchId && editing && (
        <BookingDialog
          open={bookingOpen}
          onOpenChange={(o) => {
            setBookingOpen(o);
            if (!o) {
              setEditing(null);
              setDraft(null);
            }
          }}
          branchId={effectiveBranchId}
          rooms={data?.rooms ?? []}
          editing={editing}
          draft={null}
        />
      )}

      {/* Создание новой брони — пошаговый визард */}
      {effectiveBranchId && !editing && (
        <BookingWizard
          open={bookingOpen}
          onOpenChange={(o) => {
            setBookingOpen(o);
            if (!o) setDraft(null);
          }}
          branchId={effectiveBranchId}
          rooms={data?.rooms ?? []}
          draft={draft}
        />
      )}
    </div>
  );
}

function HoverCard({ booking, x, y }: { booking: MonthlyReport; x: number; y: number }) {
  // Clamp so the card stays within the viewport.
  const W = 264;
  const left = Math.min(x + 16, window.innerWidth - W - 12);
  const top = Math.min(y + 16, window.innerHeight - 190);
  const debt = reportDebt(booking);
  const nights = nightsBetween(booking.date, booking.checkOut);
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
            {nights} {pluralRu(nights, "ночь", "ночи", "ночей")}
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

function FreeCellCard({ room, day, x, y }: { room: Room; day: Date; x: number; y: number }) {
  const W = 200;
  const left = Math.min(x + 16, window.innerWidth - W - 12);
  const top = Math.min(y + 16, window.innerHeight - 90);
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-xl border border-border bg-card p-3 text-xs shadow-xl animate-fade-in"
      style={{ left, top, width: W }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{room.roomNumber}</span>
        <Badge className="tint-emerald">Свободно</Badge>
      </div>
      <div className="text-muted-foreground">
        {room.type && <span>{room.type} · </span>}
        {formatDate(isoDay(day))}
      </div>
    </div>
  );
}

