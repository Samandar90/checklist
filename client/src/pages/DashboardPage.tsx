import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  BedDouble,
  Wallet,
  ClipboardList,
  Receipt,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowDownCircle,
  AlertTriangle,
  Percent,
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
import { cn } from "@/lib/utils";
import { useDashboard } from "@/hooks/useDashboard";
import { useBranches } from "@/hooks/useBranches";
import { useTheme } from "@/contexts/ThemeContext";
import { DashboardFilters } from "@/types";

function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  // 30d default
  const f = new Date(today);
  f.setDate(f.getDate() - 29);
  return { from: isoDay(f), to };
}

const fmt = (n: number) => n.toLocaleString("ru-RU");

const BAR_COLORS = ["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#ef4444"];

function shortDay(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

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

  const gridStroke = theme === "dark" ? "#262a38" : "#eef0f4";
  const tooltipStyle = {
    borderRadius: 12,
    border: `1px solid ${theme === "dark" ? "#262a38" : "#e2e8f0"}`,
    background: theme === "dark" ? "#13151e" : "#ffffff",
    color: theme === "dark" ? "#e7e8f0" : "inherit",
    fontSize: 13,
  };
  const chartCursor = { fill: theme === "dark" ? "#1a1d28" : "#f1f5f9" };

  const delta = data?.previous.deltaPct ?? null;

  const kpis = [
    {
      label: preset === "today" ? "Выручка за сегодня" : "Выручка за период",
      value: fmt(data?.revenue ?? 0),
      icon: Wallet,
      tint: "bg-emerald-50 text-emerald-600",
      delta: true,
    },
    {
      label: "Отчётов",
      value: fmt(data?.reports ?? 0),
      icon: ClipboardList,
      tint: "bg-violet-50 text-violet-600",
    },
    {
      label: "Средний чек",
      value: fmt(Math.round(data?.avgCheck ?? 0)),
      icon: Receipt,
      tint: "bg-amber-50 text-amber-600",
    },
    {
      label: "Выручка сегодня",
      value: fmt(data?.today.revenue ?? 0),
      icon: CalendarDays,
      tint: "bg-sky-50 text-sky-600",
      hint: `${data?.today.reports ?? 0} отчётов`,
    },
  ];

  const finance = [
    {
      label: "Чистая прибыль",
      value: fmt(data?.netProfit ?? 0),
      icon: PiggyBank,
      tint: "bg-emerald-50 text-emerald-600",
      negative: (data?.netProfit ?? 0) < 0,
    },
    {
      label: "Расходы",
      value: fmt(data?.totalExpenses ?? 0),
      icon: ArrowDownCircle,
      tint: "bg-rose-50 text-rose-600",
    },
    {
      label: "Задолженность",
      value: fmt(data?.totalDebt ?? 0),
      icon: AlertTriangle,
      tint: "bg-amber-50 text-amber-600",
      negative: (data?.totalDebt ?? 0) > 0,
    },
    {
      label: "Загрузка номеров",
      value: `${(data?.occupancy ?? 0).toFixed(1)}%`,
      icon: Percent,
      tint: "bg-sky-50 text-sky-600",
    },
  ];

  const counts = [
    { label: "Филиалы", value: data?.totals.branches ?? 0, icon: Building2, tint: "bg-indigo-50 text-indigo-600" },
    { label: "Администраторы", value: data?.totals.admins ?? 0, icon: Users, tint: "bg-amber-50 text-amber-600" },
    { label: "Номера", value: data?.totals.rooms ?? 0, icon: BedDouble, tint: "bg-sky-50 text-sky-600" },
  ];

  return (
    <div>
      <PageHeader
        title="Дашборд"
        description="Ежедневная и периодическая аналитика по сети отелей."
      />

      {/* Панель фильтров */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  preset === p.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
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
                <Input
                  type="date"
                  value={custom.from}
                  max={custom.to}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                  className="w-40"
                />
              </div>
              <div className="space-y-1.5">
                <Label>По</Label>
                <Input
                  type="date"
                  value={custom.to}
                  min={custom.from}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                  className="w-40"
                />
              </div>
            </div>
          )}

          <div className="w-56 space-y-1.5">
            <Label>Филиал</Label>
            <Select
              value={branchId ?? "all"}
              onValueChange={(v) => setBranchId(v === "all" ? undefined : v)}
            >
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
        </CardContent>
      </Card>

      {isError && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Не удалось загрузить данные дашборда. Убедитесь, что сервер запущен.
        </div>
      )}

      {/* KPI */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05, ease: "easeOut" }}
          >
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{c.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.tint}`}>
                <c.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-semibold text-foreground">{c.value}</div>
                  {c.delta && delta !== null && (
                    <p
                      className={cn(
                        "mt-1 flex items-center gap-1 text-xs font-medium",
                        delta >= 0 ? "text-emerald-600" : "text-destructive"
                      )}
                    >
                      {delta >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {Math.abs(delta).toFixed(1)}% к прошлому периоду
                    </p>
                  )}
                  {c.hint && <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>}
                </>
              )}
            </CardContent>
          </Card>
          </motion.div>
        ))}
      </div>

      {/* Финансы */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {finance.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.2 + i * 0.05, ease: "easeOut" }}
          >
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{c.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.tint}`}>
                <c.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div
                  className={cn(
                    "text-2xl font-semibold",
                    c.negative ? "text-destructive" : "text-foreground"
                  )}
                >
                  {c.value}
                </div>
              )}
            </CardContent>
          </Card>
          </motion.div>
        ))}
      </div>

      {/* Счётчики */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {counts.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.4 + i * 0.05, ease: "easeOut" }}
          >
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.tint}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-semibold text-foreground">
                  {isLoading ? <Skeleton className="h-6 w-10" /> : c.value}
                </div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
          </motion.div>
        ))}
      </div>

      {/* Динамика выручки */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle>Динамика выручки</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (data?.timeSeries ?? []).length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Нет данных за выбранный период</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data?.timeSeries} margin={{ left: 8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDay}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : String(v))}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  formatter={(v: number) => [fmt(v), "Выручка"]}
                  labelFormatter={(l) => shortDay(String(l))}
                  contentStyle={tooltipStyle}
                />
                <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Разбивки */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Выручка по филиалам</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (data?.byBranch ?? []).length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Нет данных</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.byBranch} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip
                    formatter={(v: number) => [fmt(v), "Выручка"]}
                    cursor={chartCursor}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={22}>
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
            <CardTitle>Выручка по источникам</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (data?.bySource ?? []).length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Нет данных</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.bySource} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip
                    formatter={(v: number) => [fmt(v), "Выручка"]}
                    cursor={chartCursor}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={22}>
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
            <CardTitle>Топ администраторов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (data?.byAdmin ?? []).length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Нет данных</p>
            ) : (
              data?.byAdmin.map((a, i) => (
                <div key={a.name} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm text-foreground">{a.name}</span>
                  <span className="text-xs text-muted-foreground">{a.count} шт.</span>
                  <span className="w-28 text-right text-sm font-medium text-foreground">{fmt(a.total)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>По способу оплаты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (data?.byPayment ?? []).length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Нет данных</p>
            ) : (
              data?.byPayment.map((p, i) => {
                const total = (data?.byPayment ?? []).reduce((s, x) => s + x.total, 0) || 1;
                const pct = Math.round((p.total / total) * 100);
                return (
                  <div key={p.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">{p.name}</span>
                      <span className="font-medium text-foreground">
                        {fmt(p.total)} <span className="text-muted-foreground">· {pct}%</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Расходы по категориям</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (data?.byExpense ?? []).length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Нет расходов за период</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.byExpense} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip
                    formatter={(v: number) => [fmt(v), "Расход"]}
                    cursor={chartCursor}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={22}>
                    {(data?.byExpense ?? []).map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[(i + 4) % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
