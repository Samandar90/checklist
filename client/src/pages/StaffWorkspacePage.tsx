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

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useAuth } from "@/contexts/AuthContext";
import { useReports, useUpdateReportStatus } from "@/hooks/useReports";
import { useExpenses } from "@/hooks/useExpenses";
import { useActiveCashShift } from "@/hooks/useCashShifts";
import { useCountUp } from "@/hooks/useCountUp";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import { cn, formatDate, formatDateTime, formatMoney, reportDebt } from "@/lib/utils";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function Stat({ label, value, icon: Icon, tint, money }: { label: string; value: number; icon: typeof Wallet; tint: string; money?: boolean }) {
  const animated = useCountUp(value);
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tint)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
            {Math.round(animated).toLocaleString("ru-RU")}
            {money && <span className="ml-1 text-xs font-normal text-muted-foreground">UZS</span>}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StaffWorkspacePage() {
  const { user } = useAuth();
  const { data: reports, isLoading } = useReports({});
  const { data: expenses } = useExpenses({});
  const { data: shift, isLoading: shiftLoading } = useActiveCashShift();
  const updateStatus = useUpdateReportStatus();

  const today = isoDay(new Date());
  const monthStart = today.slice(0, 7);

  const todayReports = useMemo(() => (reports ?? []).filter((r) => r.date.slice(0, 10) === today), [reports, today]);
  const todayDepartures = useMemo(
    () => (reports ?? []).filter((r) => r.checkOut && r.checkOut.slice(0, 10) === today),
    [reports, today]
  );
  const monthReports = useMemo(() => (reports ?? []).filter((r) => r.date.slice(0, 7) === monthStart), [reports, monthStart]);
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
  const overdue = useMemo(() => (reports ?? []).filter((r) => reportDebt(r) > 0), [reports]);

  const last14Days = useMemo(() => {
    const days: { date: string; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = isoDay(d);
      const total = (reports ?? []).filter((r) => r.date.slice(0, 10) === iso).reduce((s, r) => s + r.price, 0);
      days.push({ date: iso, total });
    }
    return days;
  }, [reports]);

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

  return (
    <div>
      <PageHeader title="Рабочее место" description="Смена, показатели и задачи на сегодня." />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-semibold text-foreground">
            {(user?.fullName ?? user?.username ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold tracking-tight text-foreground">{user?.fullName ?? user?.username}</p>
            <p className="text-xs text-muted-foreground">{user?.branchName} · администратор</p>
          </div>

          {shiftLoading ? (
            <Skeleton className="h-9 w-40" />
          ) : shift ? (
            <Badge className="tint-emerald gap-1.5 px-3 py-1.5 text-[12px] font-semibold">
              <LockOpen className="h-3.5 w-3.5" /> Смена открыта · {formatDateTime(shift.openedAt)}
            </Badge>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/cash-register">
                <Lock className="h-3.5 w-3.5" /> Открыть смену
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Бронирований сегодня" value={todayReports.length} icon={ClipboardList} tint="tint-violet" />
          <Stat label="Выручка сегодня" value={todayRevenue} icon={Wallet} tint="tint-emerald" money />
          <Stat label="Бронирований за месяц" value={monthReports.length} icon={TrendingUp} tint="tint-sky" />
          <Stat label="Выручка за месяц" value={monthRevenue} icon={Wallet} tint="tint-amber" money />
        </div>
      )}

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
