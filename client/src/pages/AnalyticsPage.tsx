import { useMemo, useState } from "react";
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
  Legend,
} from "recharts";
import { Wallet, Percent, Gauge, TrendingUp, Download, Building2, Users2 } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { escapeCsv } from "@/lib/csv";
import { useDashboard } from "@/hooks/useDashboard";
import { useBranches } from "@/hooks/useBranches";
import { useReports } from "@/hooks/useReports";
import { useCountUp } from "@/hooks/useCountUp";
import { useTheme } from "@/contexts/ThemeContext";
import { DashboardFilters } from "@/types";

function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function nightsBetween(date: string, checkOut?: string | null) {
  if (!checkOut) return 1;
  const diff = Math.round((new Date(checkOut).getTime() - new Date(date).getTime()) / 86400000);
  return diff > 0 ? diff : 1;
}

type PresetKey = "7d" | "30d" | "month" | "90d" | "custom";
const presets: { key: PresetKey; label: string }[] = [
  { key: "7d", label: "7 дней" },
  { key: "30d", label: "30 дней" },
  { key: "month", label: "Этот месяц" },
  { key: "90d", label: "90 дней" },
  { key: "custom", label: "Период" },
];
function rangeForPreset(key: PresetKey): { from: string; to: string } {
  const today = new Date();
  const to = isoDay(today);
  if (key === "7d") {
    const f = new Date(today);
    f.setDate(f.getDate() - 6);
    return { from: isoDay(f), to };
  }
  if (key === "month") return { from: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  if (key === "90d") {
    const f = new Date(today);
    f.setDate(f.getDate() - 89);
    return { from: isoDay(f), to };
  }
  const f = new Date(today);
  f.setDate(f.getDate() - 29);
  return { from: isoDay(f), to };
}

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");
const BAR_COLORS = ["#5b54f0", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#ef4444"];
function shortDay(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

function CountUp({ value, suffix, className }: { value: number; suffix?: string; className?: string }) {
  const animated = useCountUp(value);
  return (
    <span className={className}>
      {fmt(animated)}
      {suffix}
    </span>
  );
}

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [custom, setCustom] = useState(() => rangeForPreset("30d"));
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const range = preset === "custom" ? custom : rangeForPreset(preset);

  const filters: DashboardFilters = useMemo(() => ({ from: range.from, to: range.to, branchId }), [range.from, range.to, branchId]);
  const { data, isLoading } = useDashboard(filters);
  const { data: branches } = useBranches();
  const { data: allReports } = useReports({ branchId });
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

  const rangeDays = Math.max(1, Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000) + 1);

  // ADR / RevPAR computed from the same check-in-date basis as dashboard revenue.
  const nightsSold = useMemo(() => {
    let nights = 0;
    for (const r of allReports ?? []) {
      const d = r.date.slice(0, 10);
      if (d >= range.from && d <= range.to) nights += nightsBetween(r.date, r.checkOut);
    }
    return nights;
  }, [allReports, range.from, range.to]);

  const totalRooms = data?.totals.rooms ?? 0;
  const adr = nightsSold ? Math.round((data?.revenue ?? 0) / nightsSold) : 0;
  const revPar = totalRooms ? Math.round((data?.revenue ?? 0) / (totalRooms * rangeDays)) : 0;

  // Confirmed future revenue (already-booked, not a statistical prediction).
  const forecast = useMemo(() => {
    const today = isoDay(new Date());
    const map = new Map<string, number>();
    for (const r of allReports ?? []) {
      const d = r.date.slice(0, 10);
      if (d > today) map.set(d, (map.get(d) ?? 0) + r.price);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 30)
      .map(([date, total]) => ({ date, total }));
  }, [allReports]);

  function exportCsv() {
    const lines: string[] = ["Метрика,Значение"];
    lines.push(`Выручка за период,${data?.revenue ?? 0}`);
    lines.push(`ADR,${adr}`);
    lines.push(`RevPAR,${revPar}`);
    lines.push(`Загрузка %,${data?.occupancy ?? 0}`);
    lines.push("");
    lines.push("Филиал,Выручка");
    for (const b of data?.byBranch ?? []) lines.push(`${escapeCsv(b.name)},${b.total}`);
    lines.push("");
    lines.push("Администратор,Выручка,Кол-во");
    for (const a of data?.byAdmin ?? []) lines.push(`${escapeCsv(a.name)},${a.total},${a.count}`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `аналитика-${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const kpis = [
    { label: "Выручка", value: data?.revenue ?? 0, suffix: "", icon: Wallet, tint: "tint-indigo" },
    { label: "Загрузка", value: data?.occupancy ?? 0, suffix: "%", icon: Percent, tint: "tint-violet" },
    { label: "ADR (средний тариф)", value: adr, suffix: "", icon: Gauge, tint: "tint-amber" },
    { label: "RevPAR", value: revPar, suffix: "", icon: TrendingUp, tint: "tint-emerald" },
  ];

  return (
    <div>
      <PageHeader title="Аналитика" description="Финансовые и операционные показатели сети отелей." />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1 rounded-full border border-border bg-secondary/60 p-1">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[13px] font-medium transition-all",
                  preset === p.key ? "bg-card text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted-foreground hover:text-foreground"
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
          <div className="w-52 space-y-1.5">
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
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Экспорт CSV
        </Button>
      </div>

      {/* KPI */}
      <Card className="mb-6">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          {kpis.map((c) => (
            <div key={c.label} className="p-5">
              <div className="mb-2.5 flex items-center gap-2">
                <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg", c.tint)}>
                  <c.icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-[12.5px] font-medium text-muted-foreground">{c.label}</span>
              </div>
              {isLoading ? <Skeleton className="h-8 w-20" /> : <CountUp value={c.value} suffix={c.suffix} className="text-[26px] font-semibold tabular-nums tracking-tight text-foreground" />}
            </div>
          ))}
        </div>
      </Card>

      {/* Выручка */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle>Динамика выручки</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (data?.timeSeries ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Нет данных за период</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data?.timeSeries} margin={{ left: 8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : String(v))} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} width={44} />
                <Tooltip formatter={(v: number) => [fmt(v), "Выручка"]} labelFormatter={(l) => shortDay(String(l))} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2} fill="url(#rev)" activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Прогноз (уже подтверждённые будущие брони) */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle>Подтверждённая выручка вперёд</CardTitle>
          <p className="text-xs text-muted-foreground">Сумма уже оформленных будущих броней по дате заезда — не статистический прогноз.</p>
        </CardHeader>
        <CardContent>
          {forecast.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Будущих броней нет</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={forecast} margin={{ left: 8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : String(v))} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} width={44} />
                <Tooltip formatter={(v: number) => [fmt(v), "Бронь"]} labelFormatter={(l) => shortDay(String(l))} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fill="url(#fc)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" /> Сравнение филиалов
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.byBranch ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Нет данных</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, (data?.byBranch.length ?? 0) * 40)}>
                <BarChart data={data?.byBranch} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: tickColor }} tickLine={false} axisLine={false} width={100} />
                  <Tooltip formatter={(v: number) => [fmt(v), "Выручка"]} contentStyle={tooltipStyle} />
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
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-3.5 w-3.5" /> Эффективность администраторов
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.byBranch ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Нет данных</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, (data?.byAdmin.length ?? 0) * 40)}>
                <BarChart data={data?.byAdmin} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: tickColor }} tickLine={false} axisLine={false} width={100} />
                  <Tooltip formatter={(v: number) => [fmt(v), "Выручка"]} contentStyle={tooltipStyle} />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={20}>
                    {(data?.byAdmin ?? []).map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[(i + 3) % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Источники бронирования</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.bySource ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Нет данных</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.bySource}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : String(v))} />
                  <Tooltip formatter={(v: number) => [fmt(v), "Выручка"]} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="total" name="Выручка" radius={[6, 6, 0, 0]}>
                    {(data?.bySource ?? []).map((_, i) => (
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
            <CardTitle>Способы оплаты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.byPayment ?? []).length === 0 ? (
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
    </div>
  );
}
