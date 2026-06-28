import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  Wallet,
  TrendingUp,
  ArrowDownCircle,
  PiggyBank,
  AlertTriangle,
  Download,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
} from "lucide-react";

import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDashboard } from "@/hooks/useDashboard";
import { useBranches } from "@/hooks/useBranches";
import { useReports } from "@/hooks/useReports";
import { useExpenses } from "@/hooks/useExpenses";
import { useDebtors, useSettleDebt } from "@/hooks/useDebtors";
import { useCashShifts } from "@/hooks/useCashShifts";
import { useCountUp } from "@/hooks/useCountUp";
import { useTheme } from "@/contexts/ThemeContext";
import { cn, formatDate, formatMoney, paymentStatusClass } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");
const BAR_COLORS = ["#5b54f0", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#ef4444"];

function CountUp({ value, className }: { value: number; className?: string }) {
  const animated = useCountUp(value);
  return <span className={className}>{fmt(animated)}</span>;
}

const tabs = [
  { key: "overview", label: "Обзор" },
  { key: "transactions", label: "Транзакции" },
  { key: "expenses", label: "Расходы" },
  { key: "debtors", label: "Должники" },
  { key: "cash", label: "Касса" },
] as const;
type TabKey = (typeof tabs)[number]["key"];

interface Txn {
  id: string;
  date: string;
  type: "Бронь" | "Расход";
  label: string;
  branch: string;
  method: string;
  amount: number;
  currency: string;
  status?: string;
}

export default function FinanceCenterPage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const { data: branches } = useBranches();
  const { theme } = useTheme();

  const { data: dashboard, isLoading: dashLoading } = useDashboard({ branchId });
  const { data: reports } = useReports({ branchId });
  const { data: expenses } = useExpenses({ branchId });
  const { data: debtors, isLoading: debtorsLoading } = useDebtors(branchId);
  const { data: shifts } = useCashShifts({ branchId });
  const settle = useSettleDebt();

  const gridStroke = theme === "dark" ? "#23232b" : "#ececf0";
  const tickColor = theme === "dark" ? "#8e8e99" : "#9a9aa5";
  const tooltipStyle = {
    borderRadius: 12,
    border: `1px solid ${theme === "dark" ? "#24242c" : "#e6e6ea"}`,
    background: theme === "dark" ? "#111114" : "#ffffff",
    color: theme === "dark" ? "#ededf0" : "inherit",
    fontSize: 13,
  };

  const openShifts = (shifts ?? []).filter((s) => s.status === "OPEN");
  const cashBalance = openShifts.reduce((s, sh) => s + (sh.expectedAmount ?? sh.openingAmount), 0);

  const txns: Txn[] = useMemo(() => {
    const a: Txn[] = (reports ?? []).map((r) => ({
      id: `r-${r.id}`,
      date: r.date,
      type: "Бронь",
      label: `${r.guestName || r.source.name} · номер ${r.room.roomNumber}`,
      branch: r.branch.name,
      method: r.paymentMethod,
      amount: r.price,
      currency: r.currency,
      status: r.paymentStatus,
    }));
    const b: Txn[] = (expenses ?? []).map((e) => ({
      id: `e-${e.id}`,
      date: e.date,
      type: "Расход",
      label: e.category,
      branch: e.branch?.name ?? "—",
      method: "—",
      amount: -e.amount,
      currency: e.currency,
    }));
    return [...a, ...b].sort((x, y) => y.date.localeCompare(x.date));
  }, [reports, expenses]);

  const [typeFilter, setTypeFilter] = useState<"all" | "Бронь" | "Расход">("all");
  const filteredTxns = typeFilter === "all" ? txns : txns.filter((t) => t.type === typeFilter);

  function exportCsv() {
    const lines = ["Дата,Тип,Описание,Филиал,Способ,Сумма,Валюта"];
    for (const t of filteredTxns) {
      lines.push([formatDate(t.date), t.type, t.label, t.branch, t.method, String(t.amount), t.currency].map((v) => `"${v.replace?.(/"/g, '""') ?? v}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "финансы-транзакции.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSettle(id: string) {
    try {
      await settle.mutateAsync(id);
      toast.success("Долг погашен");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const kpis = [
    { label: "Касса (открытые смены)", value: cashBalance, icon: Wallet, tint: "tint-indigo" },
    { label: "Выручка", value: dashboard?.revenue ?? 0, icon: TrendingUp, tint: "tint-emerald" },
    { label: "Расходы", value: dashboard?.totalExpenses ?? 0, icon: ArrowDownCircle, tint: "tint-rose" },
    { label: "Прибыль", value: dashboard?.netProfit ?? 0, icon: PiggyBank, tint: "tint-violet", negative: (dashboard?.netProfit ?? 0) < 0 },
    { label: "Долги", value: dashboard?.totalDebt ?? 0, icon: AlertTriangle, tint: "tint-amber" },
  ];

  return (
    <div>
      <PageHeader title="Финансовый центр" description="Касса, платежи, расходы и должники — в одном месте." />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
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
        <Link to="/cash-register">
          <Button variant="outline" size="sm">
            <Banknote className="h-4 w-4" /> Открыть/закрыть смену
          </Button>
        </Link>
      </div>

      {/* KPI */}
      <Card className="mb-5">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          {kpis.map((c) => (
            <div key={c.label} className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg", c.tint)}>
                  <c.icon className="h-3.5 w-3.5" />
                </div>
                <span className="truncate text-[11.5px] font-medium text-muted-foreground">{c.label}</span>
              </div>
              {dashLoading ? <Skeleton className="h-7 w-20" /> : <CountUp value={c.value} className={cn("text-[22px] font-semibold tabular-nums tracking-tight", c.negative ? "text-destructive" : "text-foreground")} />}
            </div>
          ))}
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-medium text-foreground">Расходы по категориям</CardTitle>
            </CardHeader>
            <CardContent>
              {(dashboard?.byExpense ?? []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Нет расходов за период</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dashboard?.byExpense} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: tickColor }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip formatter={(v: number) => [fmt(v), "Расход"]} contentStyle={tooltipStyle} />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={20}>
                      {(dashboard?.byExpense ?? []).map((_, i) => (
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
              <CardTitle className="text-[13px] font-medium text-foreground">Способы оплаты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dashboard?.byPayment ?? []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Нет данных</p>
              ) : (
                dashboard?.byPayment.map((p, i) => {
                  const total = (dashboard?.byPayment ?? []).reduce((s, x) => s + x.total, 0) || 1;
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
      )}

      {tab === "transactions" && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex gap-1 rounded-full border border-border bg-secondary/60 p-1">
              {(["all", "Бронь", "Расход"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-all", typeFilter === t ? "bg-card text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted-foreground")}
                >
                  {t === "all" ? "Все" : t}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Экспорт CSV
            </Button>
          </div>
          {filteredTxns.length === 0 ? (
            <EmptyState icon={Wallet} title="Нет транзакций" description="Записей не найдено." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead>Филиал</TableHead>
                  <TableHead>Способ</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTxns.slice(0, 100).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">{formatDate(t.date)}</TableCell>
                    <TableCell>
                      <span className={cn("flex items-center gap-1 text-xs font-medium", t.amount >= 0 ? "text-emerald-600" : "text-destructive")}>
                        {t.amount >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {t.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-foreground">{t.label}</TableCell>
                    <TableCell className="text-muted-foreground">{t.branch}</TableCell>
                    <TableCell className="text-muted-foreground">{t.method}</TableCell>
                    <TableCell className={cn("text-right font-medium tabular-nums", t.amount >= 0 ? "text-foreground" : "text-destructive")}>
                      {t.amount >= 0 ? "+" : ""}
                      {formatMoney(t.amount, t.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {tab === "expenses" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Филиал</TableHead>
              <TableHead>Заметка</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(expenses ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Расходов нет
                </TableCell>
              </TableRow>
            ) : (
              (expenses ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">{formatDate(e.date)}</TableCell>
                  <TableCell className="text-foreground">{e.category}</TableCell>
                  <TableCell className="text-muted-foreground">{e.branch?.name ?? "—"}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-muted-foreground">{e.note || "-"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-destructive">-{formatMoney(e.amount, e.currency)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {tab === "debtors" && (
        debtorsLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !debtors || debtors.items.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Должников нет" description="Все брони оплачены полностью." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Заезд</TableHead>
                <TableHead>Филиал</TableHead>
                <TableHead>Номер</TableHead>
                <TableHead>Долг</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debtors.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{formatDate(r.date)}</TableCell>
                  <TableCell>{r.branch.name}</TableCell>
                  <TableCell>{r.room.roomNumber}</TableCell>
                  <TableCell className="font-semibold tabular-nums text-destructive">{formatMoney(r.debt, r.currency)}</TableCell>
                  <TableCell>
                    <Badge className={paymentStatusClass(r.paymentStatus)}>{r.paymentStatus}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleSettle(r.id)} disabled={settle.isPending}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Погасить
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      )}

      {tab === "cash" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Филиал / Админ</TableHead>
              <TableHead>Открыта</TableHead>
              <TableHead>Закрыта</TableHead>
              <TableHead>Начало</TableHead>
              <TableHead>Расчёт</TableHead>
              <TableHead>Факт</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(shifts ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Смен нет
                </TableCell>
              </TableRow>
            ) : (
              (shifts ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-foreground">
                    {s.branch.name} · {s.admin.fullName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(s.openedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{s.closedAt ? formatDate(s.closedAt) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatMoney(s.openingAmount, s.currency)}</TableCell>
                  <TableCell className="text-muted-foreground">{s.expectedAmount != null ? formatMoney(s.expectedAmount, s.currency) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.closingAmount != null ? formatMoney(s.closingAmount, s.currency) : "—"}</TableCell>
                  <TableCell>
                    <Badge className={s.status === "OPEN" ? "tint-emerald" : "bg-secondary text-secondary-foreground"}>{s.status === "OPEN" ? "Открыта" : "Закрыта"}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
