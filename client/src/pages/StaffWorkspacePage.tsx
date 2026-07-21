import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";
import {
  Wallet,
  ClipboardList,
  TrendingUp,
  LogIn,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  Plus,
  Pencil,
  Lock,
  LockOpen,
} from "lucide-react";

import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useAuth } from "@/contexts/AuthContext";
import { useReports, useUpdateReportStatus } from "@/hooks/useReports";
import { useExpenses } from "@/hooks/useExpenses";
import { useActiveCashShift } from "@/hooks/useCashShifts";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import { cn, formatDate, formatDateTime, formatMoney, reportDebt } from "@/lib/utils";
import { holdsRoom } from "@/lib/bookingStatus";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function StaffWorkspacePage() {
  const { user } = useAuth();
  // Странице нужны только текущий месяц и последние 14 дней — незачем тянуть
  // всю историю броней, ограничиваемся текущим годом.
  const { data: reports, isLoading } = useReports({ year: String(new Date().getFullYear()) });
  const { data: expenses } = useExpenses({});
  const { data: shift, isLoading: shiftLoading } = useActiveCashShift();
  const updateStatus = useUpdateReportStatus();

  const today = isoDay(new Date());
  const monthStart = today.slice(0, 7);

  // Единое правило по всей системе: отменённые брони и незаезды не считаются
  // ни выручкой, ни заездами — денег и ночей за ними нет.
  const activeReports = useMemo(() => (reports ?? []).filter((r) => holdsRoom(r.status)), [reports]);

  const todayReports = useMemo(() => activeReports.filter((r) => r.date.slice(0, 10) === today), [activeReports, today]);
  const todayDepartures = useMemo(
    () => activeReports.filter((r) => r.checkOut && r.checkOut.slice(0, 10) === today),
    [activeReports, today]
  );
  const monthReports = useMemo(() => activeReports.filter((r) => r.date.slice(0, 7) === monthStart), [activeReports, monthStart]);
  const todayRevenue = todayReports.reduce((s, r) => s + r.price, 0);
  const monthRevenue = monthReports.reduce((s, r) => s + r.price, 0);

  const toCheckIn = useMemo(
    () => (reports ?? []).filter((r) => r.status === "RESERVED" && r.date.slice(0, 10) <= today),
    [reports, today]
  );
  const toCheckOut = useMemo(
    () => (reports ?? []).filter((r) => r.status === "CHECKED_IN" && r.checkOut && r.checkOut.slice(0, 10) <= today),
    [reports, today]
  );
  const overdue = useMemo(() => activeReports.filter((r) => reportDebt(r) > 0), [activeReports]);

  const last14Days = useMemo(() => {
    const days: { date: string; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = isoDay(d);
      const total = activeReports.filter((r) => r.date.slice(0, 10) === iso).reduce((s, r) => s + r.price, 0);
      days.push({ date: iso, total });
    }
    return days;
  }, [activeReports]);

  const recentActions = useMemo(() => {
    const fromReports = (reports ?? []).map((r) => ({
      id: `r-${r.id}`,
      time: r.updatedAt ?? r.createdAt,
      icon: r.updatedAt ? Pencil : Plus,
      text: `${r.updatedAt ? "Изменена" : "Создана"} бронь — номер ${r.room.roomNumber}, ${r.guestName || "без имени"}`,
    }));
    const fromExpenses = (expenses ?? []).map((e) => ({
      id: `e-${e.id}`,
      time: e.updatedAt ?? e.createdAt,
      icon: Receipt,
      text: `Расход: ${e.category} · ${formatMoney(e.amount, e.currency)}`,
    }));
    return [...fromReports, ...fromExpenses].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 8);
  }, [reports, expenses]);

  async function handleStatusChange(id: string, status: "CHECKED_IN" | "CHECKED_OUT") {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(status === "CHECKED_IN" ? "Гость заселён" : "Гость выселен");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const tasksCount = toCheckIn.length + toCheckOut.length + overdue.length;

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  return (
    <div>
      {/* Hero: градиентная панель — приветствие, смена и показатели дня */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 overflow-hidden rounded-3xl p-6 text-white shadow-[0_16px_44px_rgba(14,32,64,0.35)] md:p-7"
        style={{
          background:
            "radial-gradient(120% 160% at 100% 0%, rgba(94,161,230,0.35), transparent 55%), radial-gradient(90% 140% at 0% 100%, rgba(45,108,179,0.5), transparent 60%), linear-gradient(135deg, #0e1626 0%, #16305a 60%, #24578f 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 font-display text-lg font-extrabold ring-1 ring-white/15">
              {(user?.fullName ?? user?.username ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-[24px] font-extrabold leading-tight tracking-tight">
                {greeting}, {user?.fullName ?? user?.username}
              </h1>
              <p className="text-[13px] text-white/55">{user?.branchName} · администратор · смена, показатели и задачи на сегодня</p>
            </div>
          </div>

          {shiftLoading ? (
            <Skeleton className="h-9 w-40 bg-white/10" />
          ) : shift ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3.5 py-1.5 text-[12.5px] font-bold text-emerald-300">
              <LockOpen className="h-3.5 w-3.5" /> Смена открыта · {formatDateTime(shift.openedAt)}
            </span>
          ) : (
            <Button asChild size="sm" className="bg-white text-[#16305a] shadow-none hover:bg-white/90 hover:brightness-100">
              <Link to="/cash-register">
                <Lock className="h-3.5 w-3.5" /> Открыть смену
              </Link>
            </Button>
          )}
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[
            { icon: ClipboardList, label: "Бронирований сегодня", value: todayReports.length, money: false },
            { icon: Wallet, label: "Выручка сегодня", value: todayRevenue, money: true },
            { icon: TrendingUp, label: "Бронирований за месяц", value: monthReports.length, money: false },
            { icon: Wallet, label: "Выручка за месяц", value: monthRevenue, money: true },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.07] px-3.5 py-3 backdrop-blur-sm transition-colors hover:bg-white/[0.12]"
            >
              <div className="flex items-center gap-1.5 text-white/55">
                <c.icon className="h-3.5 w-3.5" />
                <span className="truncate text-[11px] font-medium">{c.label}</span>
              </div>
              <div className="mt-1 text-lg font-bold tabular-nums leading-tight">
                {isLoading ? "—" : c.value.toLocaleString("ru-RU")}
                {c.money && <span className="ml-1 text-[11px] font-medium text-white/50">UZS</span>}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Задачи на сегодня</p>
              {tasksCount > 0 && <Badge className="tint-rose">{tasksCount}</Badge>}
            </div>
            {tasksCount === 0 ? (
              <EmptyState icon={CheckCircle2} title="Все задачи выполнены" description="На сегодня активных дел нет." />
            ) : (
              <div className="space-y-2">
                {toCheckIn.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg tint-sky"><LogIn className="h-3.5 w-3.5" /></span>
                      <div className="text-sm"><span className="font-medium text-foreground">Заселить</span> · номер {r.room.roomNumber} · {r.guestName || "Гость"}</div>
                    </div>
                    <Button size="sm" disabled={updateStatus.isPending} onClick={() => handleStatusChange(r.id, "CHECKED_IN")}>Заселить</Button>
                  </div>
                ))}
                {toCheckOut.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg tint-violet"><LogOut className="h-3.5 w-3.5" /></span>
                      <div className="text-sm"><span className="font-medium text-foreground">Выселить</span> · номер {r.room.roomNumber} · {r.guestName || "Гость"}</div>
                    </div>
                    <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => handleStatusChange(r.id, "CHECKED_OUT")}>Выселить</Button>
                  </div>
                ))}
                {overdue.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg tint-rose"><AlertTriangle className="h-3.5 w-3.5" /></span>
                      <div className="text-sm"><span className="font-medium text-foreground">Долг</span> · номер {r.room.roomNumber} · {formatMoney(reportDebt(r), r.currency)}</div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/my-reports">К отчёту</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-semibold text-foreground">Выручка за 14 дней</p>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={last14Days}>
                  <defs>
                    <linearGradient id="staffRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    formatter={(v: number) => v.toLocaleString("ru-RU")}
                    labelFormatter={(l: string) => formatDate(l)}
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2} fill="url(#staffRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-semibold text-foreground">Бронирования сегодня</p>
            {todayReports.length === 0 && todayDepartures.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Нет заездов и выездов сегодня</p>
            ) : (
              <ul className="space-y-2">
                {todayReports.map((r) => (
                  <li key={`a-${r.id}`} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><LogIn className="h-3.5 w-3.5 text-sky-500" /> {r.guestName || "Гость"} · номер {r.room.roomNumber}</span>
                    <span className="tabular-nums text-muted-foreground">{formatMoney(r.price, r.currency)}</span>
                  </li>
                ))}
                {todayDepartures.map((r) => (
                  <li key={`d-${r.id}`} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><LogOut className="h-3.5 w-3.5 text-violet-500" /> {r.guestName || "Гость"} · номер {r.room.roomNumber}</span>
                    <span className="tabular-nums text-muted-foreground">выезд</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-semibold text-foreground">Недавние действия</p>
            {recentActions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Пока нет активности</p>
            ) : (
              <ul className="space-y-2.5">
                {recentActions.map((a, i) => (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="flex items-start gap-2.5"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg tint-slate">
                      <a.icon className="h-3 w-3" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-foreground">{a.text}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDateTime(a.time)}</p>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
