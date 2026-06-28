import { useMemo, useState } from "react";
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
import { useCountUp } from "@/hooks/useCountUp";
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
  const f = new Date(today);
  f.setDate(f.getDate() - 29);
  return { from: isoDay(f), to };
}

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

// Monochrome-leaning palette anchored on the brand accent, fanning out to a few
// distinguishable hues so multi-series charts stay legible without looking like
// a generic rainbow template.
const BAR_COLORS = ["#5b54f0", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#ef4444"];

function shortDay(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

function CountUp({ value, className }: { value: number; className?: string }) {
  const animated = useCountUp(value);
  return <span className={className}>{fmt(animated)}</span>;
}

/** Tiny inline trend line used inside hero stat tiles — no axes, just a vibe. */
function Sparkline({ data, color }: { data: { total: number }[]; color: string }) {
  if (data.length < 2) return null;
  return (
    <ResponsiveContainer width="100%" height={40}>
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

  const secondaryKpis = [
    {
      label: "Отчётов",
      value: data?.reports ?? 0,
      icon: ClipboardList,
      tint: "bg-violet-50 text-violet-600",
    },
    {
      label: "Средний чек",
      value: Math.round(data?.avgCheck ?? 0),
      icon: Receipt,
      tint: "bg-amber-50 text-amber-600",
    },
    {
      label: "Выручка сегодня",
      value: data?.today.revenue ?? 0,
      icon: Wallet,
      tint: "bg-sky-50 text-sky-600",
      hint: `${data?.today.reports ?? 0} отчётов`,
    },
  ];

  const finance = [
    {
      label: "Чистая прибыль",
      value: data?.netProfit ?? 0,
      icon: PiggyBank,
      tint: "bg-emerald-50 text-emerald-600",
      negative: (data?.netProfit ?? 0) < 0,
    },
    {
      label: "Расходы",
      value: data?.totalExpenses ?? 0,
      icon: ArrowDownCircle,
      tint: "bg-rose-50 text-rose-600",
    },
    {
      label: "Задолженность",
      value: data?.totalDebt ?? 0,
      icon: AlertTriangle,
      tint: "bg-amber-50 text-amber-600",
      negative: (data?.totalDebt ?? 0) > 0,
    },
    {
      label: "Загрузка номеров",
      value: data?.occupancy ?? 0,
      suffix: "%",
      icon: Percent,
      tint: "bg-sky-50 text-sky-600",
    },
  ];

  const counts = [
    { label: "Филиалы", value: data?.totals.branches ?? 0, icon: Building2, tint: "bg-indigo-50 text-indigo-600" },
    { label: "Администраторы", value: data?.totals.admins ?? 0, icon: Users, tint: "bg-amber-50 text-amber-600" },
    { label: "Номера", value: data?.totals.rooms ?? 0, icon: BedDouble, tint: "bg-sky-50 text-sky-600" },
  ];

  const maxAdmin = Math.max(1, ...(data?.byAdmin ?? []).map((a) => a.total));

  return (
    <div>
      <PageHeader title="Дашборд" description="Ежедневная и периодическая аналитика по сети отелей." />

      {/* Панель фильтров — flush, без коробки */}
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

      {/* Герой-метрика: выручка крупно, со спарклайном */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              <span className="text-[12.5px] font-medium">
                {preset === "today" ? "Выручка за сегодня" : "Выручка за период"}
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="mt-3 h-9 w-36" />
            ) : (
              <div className="mt-1.5 flex items-baseline gap-2">
                <CountUp value={data?.revenue ?? 0} className="text-[34px] font-semibold tabular-nums tracking-tight text-foreground" />
                {delta !== null && (
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-[12.5px] font-semibold",
                      delta >= 0 ? "text-emerald-600" : "text-destructive"
                    )}
                  >
                    {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {Math.abs(delta).toFixed(1)}%
                  </span>
                )}
              </div>
            )}
            <div className="mt-3 -mx-1">
              {!isLoading && timeSeries.length >= 2 && <Sparkline data={timeSeries} color="#5b54f0" />}
            </div>
          </CardContent>
        </Card>

        {secondaryKpis.map((c) => (
          <Card key={c.label}>
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
                <>
                  <CountUp value={c.value} className="text-[26px] font-semibold tabular-nums tracking-tight text-foreground" />
                  {c.hint && <p className="mt-1.5 text-xs text-muted-foreground">{c.hint}</p>}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Финансы */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {finance.map((c) => (
            <div key={c.label} className="p-5">
              <div className="mb-2.5 flex items-center gap-2">
                <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[12.5px] font-medium text-muted-foreground">{c.label}</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className={cn("text-[26px] font-semibold tabular-nums tracking-tight", c.negative ? "text-destructive" : "text-foreground")}>
                  <CountUp value={c.value} />
                  {c.suffix}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Счётчики */}
      <Card className="mb-6">
        <div className="grid grid-cols-3 divide-x divide-border">
          {counts.map((c) => (
            <div key={c.label} className="flex items-center gap-3 p-4">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.tint}`}>
                <c.icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-lg font-semibold tabular-nums text-foreground">
                  {isLoading ? <Skeleton className="h-6 w-10" /> : c.value}
                </div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Динамика выручки */}
      <Card className="mb-6">
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
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={timeSeries} margin={{ left: 8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5b54f0" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#5b54f0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDay}
                  tick={{ fontSize: 11, fill: tickColor }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : String(v))}
                  tick={{ fontSize: 11, fill: tickColor }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  formatter={(v: number) => [fmt(v), "Выручка"]}
                  labelFormatter={(l) => shortDay(String(l))}
                  contentStyle={tooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#5b54f0"
                  strokeWidth={2}
                  fill="url(#rev)"
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Разбивки */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-medium text-foreground">Выручка по филиалам</CardTitle>
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
                    tick={{ fontSize: 12, fill: tickColor }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip formatter={(v: number) => [fmt(v), "Выручка"]} cursor={chartCursor} contentStyle={tooltipStyle} />
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
            <CardTitle className="text-[13px] font-medium text-foreground">Выручка по источникам</CardTitle>
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
                    tick={{ fontSize: 12, fill: tickColor }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip formatter={(v: number) => [fmt(v), "Выручка"]} cursor={chartCursor} contentStyle={tooltipStyle} />
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
            <CardTitle className="text-[13px] font-medium text-foreground">Топ администраторов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (data?.byAdmin ?? []).length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Нет данных</p>
            ) : (
              data?.byAdmin.map((a, i) => (
                <div key={a.name}>
                  <div className="mb-1 flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm text-foreground">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.count} шт.</span>
                    <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">{fmt(a.total)}</span>
                  </div>
                  <div className="ml-7 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all duration-500"
                      style={{ width: `${Math.max(4, Math.round((a.total / maxAdmin) * 100))}%` }}
                    />
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
                      <span className="font-medium tabular-nums text-foreground">
                        {fmt(p.total)} <span className="text-muted-foreground">· {pct}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all duration-500"
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
            <CardTitle className="text-[13px] font-medium text-foreground">Расходы по категориям</CardTitle>
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
                    tick={{ fontSize: 12, fill: tickColor }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip formatter={(v: number) => [fmt(v), "Расход"]} cursor={chartCursor} contentStyle={tooltipStyle} />
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
