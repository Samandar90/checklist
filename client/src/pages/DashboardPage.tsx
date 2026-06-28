import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  BedDouble,
  Wallet,
  ClipboardList,
  Receipt,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowDownCircle,
  AlertTriangle,
  Percent,
  DoorOpen,
  LogIn,
  LogOut,
  CalendarPlus,
  CalendarRange,
  Banknote,
  FileText,
  History,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate, formatMoney, reportDebt } from "@/lib/utils";
import { useDashboard } from "@/hooks/useDashboard";
import { useBranches } from "@/hooks/useBranches";
import { useReports } from "@/hooks/useReports";
import { useExpenses } from "@/hooks/useExpenses";
import { useAudit } from "@/hooks/useAudit";
import { useCountUp } from "@/hooks/useCountUp";
import { useTheme } from "@/contexts/ThemeContext";
import { DashboardFilters } from "@/types";

function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(iso: string, n: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

type PresetKey = "today" | "7d" | "30d" | "month" | "custom";

const presets: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "7d", label: "7 дней" },
  { key: "30d", label: "30 дней" },
  { key: "month", label: "Этот месяц" },
  { key: "custom", label: "Период" },
];

function rangeForPreset(key: PresetKey): { from: string; to: string } {
  const today = new Date();
  const to = isoDay(today);
  if (key === "today") return { from: to, to };
  if (key === "7d") {
    const f = new Date(today);
    f.setDate(f.getDate() - 6);
    return { from: isoDay(f), to };
  }
  if (key === "month") {
    return { from: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  }
  const f = new Date(today);
  f.setDate(f.getDate() - 29);
  return { from: isoDay(f), to };
}

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");
const BAR_COLORS = ["#5b54f0", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#ef4444"];

function shortDay(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

const staggerContainer = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] as const } },
};

function CountUp({ value, className }: { value: number; className?: string }) {
  const animated = useCountUp(value);
  return <span className={className}>{fmt(animated)}</span>;
}

function Sparkline({ data, color }: { data: { total: number }[]; color: string }) {
  if (data.length < 2) return null;
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="total" stroke={color} strokeWidth={1.75} fill="url(#spark)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Compact glance tile used in the hero strip. */
function HeroStat({
  icon: Icon,
  label,
  value,
  suffix,
  tint,
  isLoading,
}: {
  icon: typeof Wallet;
  label: string;
  value: number;
  suffix?: string;
  tint: string;
  isLoading: boolean;
}) {
  return (
    <motion.div variants={staggerItem} className="flex items-center gap-3 p-4">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tint)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        {isLoading ? (
          <Skeleton className="h-5 w-16" />
        ) : (
          <div className="text-[17px] font-semibold tabular-nums tracking-tight text-foreground">
            <CountUp value={value} />
            {suffix}
          </div>
        )}
        <p className="truncate text-[11.5px] text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  );
}

const quickActions = [
  { to: "/calendar", label: "Новая бронь", icon: CalendarPlus },
  { to: "/calendar", label: "Шахматка", icon: CalendarRange },
  { to: "/cash-register", label: "Касса", icon: Banknote },
  { to: "/reports", label: "Отчёты", icon: FileText },
  { to: "/expenses", label: "Расход", icon: Wallet },
  { to: "/rooms", label: "Номера", icon: BedDouble },
];

export default function DashboardPage() {
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [custom, setCustom] = useState<{ from: string; to: string }>(() => rangeForPreset("30d"));
  const [branchId, setBranchId] = useState<string | undefined>(undefined);

  const range = preset === "custom" ? custom : rangeForPreset(preset);
  const filters: DashboardFilters = useMemo(
    () => ({ from: range.from, to: range.to, branchId }),
    [range.from, range.to, branchId]
  );

  const { data, isLoading, isError } = useDashboard(filters);
  const { data: branches } = useBranches();
  const { theme } = useTheme();

  const today = isoDay(new Date());
  const now = new Date();
  const { data: monthReports, isLoading: reportsLoading } = useReports({
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    branchId,
  });
  const { data: todayExpenses } = useExpenses({ from: today, to: today, branchId });
  const { data: activity } = useAudit({ page: 1 });

  const gridStroke = theme === "dark" ? "#23232b" : "#ececf0";
  const tickColor = theme === "dark" ? "#8e8e99" : "#9a9aa5";
  const tooltipStyle = {
    borderRadius: 12,
    border: `1px solid ${theme === "dark" ? "#24242c" : "#e6e6ea"}`,
    background: theme === "dark" ? "#111114" : "#ffffff",
    color: theme === "dark" ? "#ededf0" : "inherit",
    fontSize: 13,
    boxShadow: "0 8px 24px rgba(16,24,40,0.08)",
  };
  const chartCursor = { fill: theme === "dark" ? "#18181d" : "#f5f5f7" };

  const delta = data?.previous.deltaPct ?? null;
  const timeSeries = data?.timeSeries ?? [];

  const arrivalsToday = useMemo(
    () => (monthReports ?? []).filter((r) => r.date.slice(0, 10) === today),
    [monthReports, today]
  );
  const departuresToday = useMemo(
    () => (monthReports ?? []).filter((r) => r.checkOut && r.checkOut.slice(0, 10) === today),
    [monthReports, today]
  );
  const overdue = useMemo(
    () => (monthReports ?? []).filter((r) => reportDebt(r) > 0 && r.date.slice(0, 10) <= today),
    [monthReports, today]
  );
  const upcoming = useMemo(() => {
    const limit = addDays(today, 3);
    return (monthReports ?? []).filter((r) => r.date.slice(0, 10) > today && r.date.slice(0, 10) <= limit);
  }, [monthReports, today]);

  const occupiedNow = data?.totals.rooms
    ? Math.round(((data.occupancy ?? 0) / 100) * data.totals.rooms)
    : 0;
  const freeRooms = Math.max(0, (data?.totals.rooms ?? 0) - occupiedNow);

  const todayExpenseSum = (todayExpenses ?? []).reduce((s, e) => s + e.amount, 0);

  const kpis = [
    { label: "Отчётов в периоде", value: data?.reports ?? 0, icon: ClipboardList, tint: "tint-violet" },
    { label: "Средний чек", value: Math.round(data?.avgCheck ?? 0), icon: Receipt, tint: "tint-amber" },
    {
      label: "Чистая прибыль",
      value: data?.netProfit ?? 0,
      icon: PiggyBank,
      tint: "tint-emerald",
      negative: (data?.netProfit ?? 0) < 0,
    },
    { label: "Расходы", value: data?.totalExpenses ?? 0, icon: ArrowDownCircle, tint: "tint-rose" },
  ];

  const counts = [
    { label: "Филиалы", value: data?.totals.branches ?? 0, icon: Building2, tint: "tint-indigo" },
    { label: "Администраторы", value: data?.totals.admins ?? 0, icon: Users, tint: "tint-amber" },
    { label: "Номера", value: data?.totals.rooms ?? 0, icon: BedDouble, tint: "tint-sky" },
  ];

  const maxAdmin = Math.max(1, ...(data?.byAdmin ?? []).map((a) => a.total));

  return (
    <div>
      <PageHeader title="Дашборд" description="Главный экран — обзор сети отелей и текущих операций." />

      {/* Фильтры */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1 rounded-full border border-border bg-secondary/60 p-1">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[13px] font-medium transition-all",
                  preset === p.key
                    ? "bg-card text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label>С</Label>
                <Input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="w-40" />
              </div>
              <div className="space-y-1.5">
                <Label>По</Label>
                <Input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="w-40" />
              </div>
            </div>
          )}
        </div>
        <div className="w-56 space-y-1.5">
          <Label>Филиал</Label>
          <Select value={branchId ?? "all"} onValueChange={(v) => setBranchId(v === "all" ? undefined : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Все филиалы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все филиалы</SelectItem>
              {(branches ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Не удалось загрузить данные дашборда. Убедитесь, что сервер запущен.
        </div>
      )}

      {/* Hero: срез по сегодня */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show">
        <Card className="mb-6">
          <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0 lg:grid-cols-7">
            <HeroStat icon={Wallet} label="Выручка сегодня" value={data?.today.revenue ?? 0} tint="tint-indigo" isLoading={isLoading} />
            <HeroStat icon={Percent} label="Загрузка сейчас" value={data?.occupancy ?? 0} suffix="%" tint="tint-violet" isLoading={isLoading} />
            <HeroStat icon={DoorOpen} label="Свободно номеров" value={freeRooms} tint="tint-emerald" isLoading={isLoading} />
            <HeroStat icon={LogIn} label="Заездов сегодня" value={arrivalsToday.length} tint="tint-sky" isLoading={reportsLoading} />
            <HeroStat icon={LogOut} label="Выездов сегодня" value={departuresToday.length} tint="tint-slate" isLoading={reportsLoading} />
            <HeroStat icon={AlertTriangle} label="Открытых долгов" value={overdue.length} tint="tint-rose" isLoading={reportsLoading} />
            <HeroStat icon={TrendingUp} label="Выручка за месяц" value={data?.revenue ?? 0} tint="tint-amber" isLoading={isLoading} />
          </div>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* KPI с трендом и спарклайном */}
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <motion.div variants={staggerItem}>
              <Card className="relative overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg tint-indigo">
                      <Wallet className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[12.5px] font-medium text-muted-foreground">Выручка за период</span>
                  </div>
                  {isLoading ? (
                    <Skeleton className="mt-3 h-9 w-36" />
                  ) : (
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <CountUp value={data?.revenue ?? 0} className="text-[30px] font-semibold tabular-nums tracking-tight text-foreground" />
                      {delta !== null && (
                        <span className={cn("flex items-center gap-0.5 text-[12.5px] font-semibold", delta >= 0 ? "text-emerald-600" : "text-destructive")}>
                          {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {Math.abs(delta).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-3 -mx-1">{!isLoading && timeSeries.length >= 2 && <Sparkline data={timeSeries} color="#5b54f0" />}</div>
                </CardContent>
              </Card>
            </motion.div>

            {kpis.map((c) => (
              <motion.div key={c.label} variants={staggerItem}>
                <Card>
                  <CardContent className="p-5">
                    <div className="mb-2.5 flex items-center gap-2">
                      <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg", c.tint)}>
                        <c.icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[12.5px] font-medium text-muted-foreground">{c.label}</span>
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <CountUp
                        value={c.value}
                        className={cn("text-[26px] font-semibold tabular-nums tracking-tight", c.negative ? "text-destructive" : "text-foreground")}
                      />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Динамика выручки */}
          <Card>
            <CardHeader className="flex-row items-baseline justify-between space-y-0 pb-2">
              <CardTitle className="text-[13px] font-medium text-foreground">Динамика выручки</CardTitle>
              {!isLoading && timeSeries.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {shortDay(timeSeries[0].date)} – {shortDay(timeSeries[timeSeries.length - 1].date)}
                </span>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : timeSeries.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Нет данных за выбранный период</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={timeSeries} margin={{ left: 8, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5b54f0" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="#5b54f0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : String(v))} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip formatter={(v: number) => [fmt(v), "Выручка"]} labelFormatter={(l) => shortDay(String(l))} contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="total" stroke="#5b54f0" strokeWidth={2} fill="url(#rev)" activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Разбивки */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[13px] font-medium text-foreground">Выручка по филиалам</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (data?.byBranch ?? []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data?.byBranch} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: tickColor }} tickLine={false} axisLine={false} width={100} />
                      <Tooltip formatter={(v: number) => [fmt(v), "Выручка"]} cursor={chartCursor} contentStyle={tooltipStyle} />
                      <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={20}>
                        {(data?.byBranch ?? []).map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[13px] font-medium text-foreground">Выручка по источникам</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (data?.bySource ?? []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data?.bySource} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: tickColor }} tickLine={false} axisLine={false} width={100} />
                      <Tooltip formatter={(v: number) => [fmt(v), "Выручка"]} cursor={chartCursor} contentStyle={tooltipStyle} />
                      <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={20}>
                        {(data?.bySource ?? []).map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[(i + 2) % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[13px] font-medium text-foreground">Топ администраторов</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (data?.byAdmin ?? []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  data?.byAdmin.slice(0, 5).map((a, i) => (
                    <div key={a.name}>
                      <div className="mb-1 flex items-center gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="flex-1 truncate text-sm text-foreground">{a.name}</span>
                        <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">{fmt(a.total)}</span>
                      </div>
                      <div className="ml-7 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary/70 transition-all duration-500" style={{ width: `${Math.max(4, Math.round((a.total / maxAdmin) * 100))}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[13px] font-medium text-foreground">По способу оплаты</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (data?.byPayment ?? []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  data?.byPayment.map((p, i) => {
                    const total = (data?.byPayment ?? []).reduce((s, x) => s + x.total, 0) || 1;
                    const pct = Math.round((p.total / total) * 100);
                    return (
                      <div key={p.name}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-muted-foreground">{p.name}</span>
                          <span className="font-medium tabular-nums text-foreground">
                            {fmt(p.total)} <span className="text-muted-foreground">· {pct}%</span>
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Счётчики */}
          <Card>
            <div className="grid grid-cols-3 divide-x divide-border">
              {counts.map((c) => (
                <div key={c.label} className="flex items-center gap-3 p-4">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.tint}`}>
                    <c.icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold tabular-nums text-foreground">{isLoading ? <Skeleton className="h-6 w-10" /> : c.value}</div>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Правая колонка: операции, быстрые действия, активность */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-medium text-foreground">Сегодняшние операции</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <OpsRow icon={LogIn} tint="tint-sky" label="Заезды" count={arrivalsToday.length} items={arrivalsToday.slice(0, 3).map((r) => `${r.room.roomNumber} · ${r.guestName || r.source.name}`)} loading={reportsLoading} />
              <OpsRow icon={LogOut} tint="tint-slate" label="Выезды" count={departuresToday.length} items={departuresToday.slice(0, 3).map((r) => `${r.room.roomNumber} · ${r.guestName || r.source.name}`)} loading={reportsLoading} />
              <OpsRow
                icon={AlertTriangle}
                tint="tint-rose"
                label="Просроченные долги"
                count={overdue.length}
                items={overdue.slice(0, 3).map((r) => `${r.room.roomNumber} · ${formatMoney(reportDebt(r), r.currency)}`)}
                loading={reportsLoading}
              />
              <OpsRow icon={Clock} tint="tint-amber" label="Скоро заезд (3 дня)" count={upcoming.length} items={upcoming.slice(0, 3).map((r) => `${r.room.roomNumber} · ${formatDate(r.date)}`)} loading={reportsLoading} />
              <OpsRow icon={Wallet} tint="tint-violet" label="Расходы сегодня" count={(todayExpenses ?? []).length} items={(todayExpenses ?? []).slice(0, 3).map((e) => `${e.category} · ${formatMoney(e.amount, e.currency)}`)} loading={false} hint={todayExpenseSum > 0 ? formatMoney(todayExpenseSum, "UZS") : undefined} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-medium text-foreground">Быстрые действия</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((a) => (
                  <Link
                    key={a.label}
                    to={a.to}
                    className="flex flex-col items-start gap-2 rounded-xl border border-border p-3 text-left transition-colors hover:border-foreground/15 hover:bg-secondary/60"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg tint-indigo">
                      <a.icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[12.5px] font-medium text-foreground">{a.label}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-baseline justify-between space-y-0 pb-2">
              <CardTitle className="text-[13px] font-medium text-foreground">Последние действия</CardTitle>
              <Link to="/audit" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                Все <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {!activity ? (
                <Skeleton className="h-40 w-full" />
              ) : activity.items.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Пока нет записей</p>
              ) : (
                activity.items.slice(0, 6).map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg tint-slate">
                      <History className="h-3 w-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] text-foreground">{a.summary}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.actorName} · {formatDate(a.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OpsRow({
  icon: Icon,
  tint,
  label,
  count,
  items,
  loading,
  hint,
}: {
  icon: typeof LogIn;
  tint: string;
  label: string;
  count: number;
  items: string[];
  loading: boolean;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2.5">
        <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", tint)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-[12.5px] font-medium text-foreground">{label}</span>
        {loading ? <Skeleton className="h-5 w-8" /> : <span className="text-sm font-semibold tabular-nums text-foreground">{count}</span>}
      </div>
      {!loading && items.length > 0 && (
        <ul className="ml-8 space-y-0.5">
          {items.map((it, i) => (
            <li key={i} className="truncate text-[11.5px] text-muted-foreground">
              {it}
            </li>
          ))}
        </ul>
      )}
      {!loading && hint && <p className="ml-8 mt-0.5 text-[11.5px] font-medium text-muted-foreground">Итого: {hint}</p>}
    </div>
  );
}
