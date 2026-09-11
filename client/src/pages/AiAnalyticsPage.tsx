import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  Sparkles,
  Wallet,
  Percent,
  Gauge,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Activity,
  Info,
  Send,
  RefreshCw,
  ArrowRight,
  Loader2,
  Bot,
} from "lucide-react";

import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, isoDay } from "@/lib/utils";
import { useBranches } from "@/hooks/useBranches";
import { useAiOverview, useAiNarrative, useAskAi } from "@/hooks/useAiAnalytics";
import { useCountUp } from "@/hooks/useCountUp";
import { useTheme } from "@/contexts/ThemeContext";
import { getErrorMessage } from "@/lib/api";
import { AiInsight, AiInsightKind, AiInsightSeverity, DashboardFilters } from "@/types";

/*
 * AI analytics — the structure is borrowed from the products that do this
 * best for hotels (Lighthouse's Revenue Agent feed and plain-language Q&A,
 * Cloudbeds Signals): a narrated summary on top, the four revenue KPIs with
 * deltas, a forecast with a confidence band, a feed of prioritised
 * opportunities / risks / anomalies, and "ask your data" in plain Russian.
 * Answers come from the app's own local analyst (rules + statistics, no
 * external API); Claude joins in only when ANTHROPIC_API_KEY is configured.
 */

type PresetKey = "7d" | "30d" | "month" | "90d";
const presets: { key: PresetKey; label: string }[] = [
  { key: "7d", label: "7 дней" },
  { key: "30d", label: "30 дней" },
  { key: "month", label: "Этот месяц" },
  { key: "90d", label: "90 дней" },
];
function rangeForPreset(key: PresetKey): { from: string; to: string } {
  const today = new Date();
  const to = isoDay(today);
  if (key === "month") return { from: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  const days = key === "7d" ? 6 : key === "90d" ? 89 : 29;
  const f = new Date(today);
  f.setDate(f.getDate() - days);
  return { from: isoDay(f), to };
}

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");
const fmtK = (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}м` : v >= 1000 ? `${Math.round(v / 1000)}к` : String(Math.round(v)));
function shortDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

const SUGGESTIONS = [
  "Почему выручка изменилась по сравнению с прошлым периодом?",
  "Какие дни в ближайшие две недели самые слабые и что с ними делать?",
  "Какой канал приносит больше всего выручки?",
  "Где мы теряем деньги: долги, отмены или расходы?",
  "Что сделать, чтобы поднять загрузку в выходные?",
  "Выручка по филиалам за прошлый месяц",
  "Были ли необычные дни?",
];

const KIND_ICON: Record<AiInsightKind, typeof Info> = {
  risk: AlertTriangle,
  opportunity: Lightbulb,
  anomaly: Activity,
  trend: TrendingUp,
  info: Info,
};
const SEVERITY: Record<AiInsightSeverity, { label: string; tint: string; dot: string }> = {
  critical: { label: "Критично", tint: "tint-rose", dot: "bg-[#ff3b30]" },
  warning: { label: "Внимание", tint: "tint-amber", dot: "bg-[#ff9500]" },
  good: { label: "Возможность", tint: "tint-emerald", dot: "bg-[#34c759]" },
  neutral: { label: "На заметку", tint: "tint-slate", dot: "bg-[#8e8e93]" },
};

function CountUp({ value, suffix, className }: { value: number; suffix?: string; className?: string }) {
  const animated = useCountUp(value);
  return (
    <span className={className}>
      {fmt(animated)}
      {suffix}
    </span>
  );
}

function Delta({ value, unit = "%", invert = false }: { value: number | null; unit?: string; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-[12px] text-muted-foreground">нет базы</span>;
  const good = invert ? value <= 0 : value >= 0;
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold", good ? "tint-emerald" : "tint-rose")}>
      <Icon className="h-3 w-3" />
      {value > 0 ? "+" : ""}
      {unit === "%" ? `${value.toFixed(value % 1 === 0 ? 0 : 1)}%` : `${Math.round(value)} ${unit}`}
    </span>
  );
}

function InsightCard({ insight }: { insight: AiInsight }) {
  const Icon = KIND_ICON[insight.kind];
  const sev = SEVERITY[insight.severity];
  return (
    <Card className="animate-rise flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", sev.tint)}>
            <Icon className="h-4 w-4" />
          </div>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium", sev.tint)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", sev.dot)} />
            {sev.label}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground">{insight.title}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{insight.detail}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          {insight.metric ? (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-foreground">{insight.metric}</span>
          ) : (
            <span />
          )}
          {insight.link && (
            <Link to={insight.link} className="inline-flex items-center gap-1 text-[13px] font-medium text-link hover:underline">
              Открыть <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type ChatMessage = { role: "user" | "assistant"; text: string; engine?: "local" | "claude"; model?: string; followUps?: string[] };
type KpiCard = { label: string; value: number; suffix: string; delta: number | null; unit?: string; icon: typeof Wallet; tint: string };

export default function AiAnalyticsPage() {
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const range = rangeForPreset(preset);
  const filters: DashboardFilters = useMemo(() => ({ from: range.from, to: range.to, branchId }), [range.from, range.to, branchId]);

  const { data, isLoading } = useAiOverview(filters);
  const narrative = useAiNarrative(filters, !!data);
  const { data: branches } = useBranches();
  const ask = useAskAi();
  const { theme } = useTheme();

  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [askError, setAskError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const gridStroke = theme === "dark" ? "#2c2c2e" : "#e8e8ed";
  const tickColor = theme === "dark" ? "#86868b" : "#6e6e73";
  const tooltipStyle = {
    borderRadius: 12,
    border: `1px solid ${theme === "dark" ? "#424245" : "#d6d6d6"}`,
    background: theme === "dark" ? "#1d1d1f" : "#ffffff",
    color: theme === "dark" ? "#f5f5f7" : "#1d1d1f",
    fontSize: 13,
    boxShadow: theme === "dark" ? "0 0 0 1px rgba(255,255,255,0.08), 0 24px 64px -16px rgba(0,0,0,0.85)" : "0 8px 24px rgba(0,0,0,0.08)",
  };

  const today = isoDay(new Date());

  // Actual (last 30 days) + forecast (next 14) on one axis; the join point
  // carries both keys so the dashed line continues from the solid one.
  const chartData = useMemo(() => {
    if (!data) return [];
    const actual = data.recent.map((p) => ({ date: p.date, actual: p.revenue }));
    const last = actual[actual.length - 1];
    const forecast = data.forecast.map((f) => ({ date: f.date, forecast: f.revenue, band: [f.low, f.high] as [number, number], confirmed: f.confirmed }));
    return [...actual.slice(0, -1), last ? { ...last, forecast: last.actual } : last, ...forecast].filter(Boolean);
  }, [data]);

  async function submit(q: string) {
    const text = q.trim();
    if (!text || ask.isPending) return;
    setQuestion("");
    setAskError(null);
    setChat((c) => [...c, { role: "user", text }]);
    try {
      const res = await ask.mutateAsync({ ...filters, question: text });
      setChat((c) => [...c, { role: "assistant", text: res.answer, engine: res.engine, model: res.model, followUps: res.followUps }]);
    } catch (err) {
      setAskError(getErrorMessage(err));
      setChat((c) => c.slice(0, -1));
      setQuestion(text);
    } finally {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  }

  const k = data?.kpis;
  const kpis: KpiCard[] = k
    ? [
        { label: "Выручка", value: k.revenue, suffix: "", delta: k.revenueDeltaPct, icon: Wallet, tint: "tint-indigo" },
        { label: "Загрузка", value: k.occupancy, suffix: "%", delta: k.prevOccupancy ? k.occupancy - k.prevOccupancy : null, unit: "п.п.", icon: Percent, tint: "tint-violet" },
        { label: "ADR (средний тариф)", value: k.adr, suffix: "", delta: k.prevAdr ? ((k.adr - k.prevAdr) / k.prevAdr) * 100 : null, icon: Gauge, tint: "tint-amber" },
        { label: "RevPAR", value: k.revpar, suffix: "", delta: k.prevRevpar ? ((k.revpar - k.prevRevpar) / k.prevRevpar) * 100 : null, icon: TrendingUp, tint: "tint-emerald" },
      ]
    : [];
  // While loading, four empty slots keep the grid from collapsing.
  const kpiCards: (KpiCard | null)[] = isLoading ? [null, null, null, null] : kpis;

  const aiOn = data?.aiAvailable ?? false;

  return (
    <div>
      <PageHeader title="AI-аналитика" description="Прогноз, аномалии, приоритетные риски и возможности — и ответы на вопросы по вашим данным." />

      {/* Фильтры */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full bg-secondary/70 p-1">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all",
                  preset === p.key ? "bg-card text-foreground shadow-[0_3px_8px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)] dark:bg-secondary-hover dark:shadow-none" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
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
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium tint-indigo">
          <Bot className="h-3.5 w-3.5" />
          {aiOn ? `Локальный аналитик + ${data?.model ?? "Claude"}` : "Локальный аналитик · без внешних API"}
        </span>
      </div>

      {/* Сводка */}
      <Card className="mb-6 animate-rise">
        <CardContent className="p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">Сводка за период</h2>
                {aiOn && (
                  <button
                    onClick={() => narrative.refetch()}
                    disabled={narrative.isFetching}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", narrative.isFetching && "animate-spin")} /> Обновить
                  </button>
                )}
              </div>
              {isLoading || narrative.isLoading ? (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : (
                <p className="mt-2.5 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                  {narrative.data?.text ?? data?.summary ?? "Нет данных за период."}
                </p>
              )}
              {narrative.isError && (
                <p className="mt-2 text-[12.5px] text-muted-foreground">Сводка недоступна ({getErrorMessage(narrative.error)}).</p>
              )}
              {narrative.data && (
                <p className="mt-2.5 text-[11.5px] text-muted-foreground">
                  {narrative.data.engine === "claude" ? `Написано ${narrative.data.model ?? "Claude"} по вашим цифрам` : "Собрано локальным аналитиком по вашим цифрам — без внешних сервисов"}
                  {narrative.data.note ? ` · ${narrative.data.note}` : ""}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((c, i) => (
          <Card key={c ? c.label : i} className="animate-rise">
            <CardContent className="p-5">
              {!c ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", c.tint)}>
                      <c.icon className="h-4 w-4" />
                    </div>
                    <Delta value={c.delta} unit={c.unit ?? "%"} />
                  </div>
                  <CountUp value={c.value} suffix={c.suffix} className="mt-3 block text-[24px] font-semibold leading-tight tabular-nums tracking-[-0.02em] text-foreground" />
                  <span className="text-[12.5px] font-medium text-muted-foreground">{c.label}</span>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Прогноз */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Выручка: факт и прогноз на 14 дней</CardTitle>
              <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-primary" /> Факт</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full border-t-2 border-dashed border-primary" /> Прогноз</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-primary/15" /> Коридор</span>
              </div>
            </div>
            <p className="text-[12.5px] text-muted-foreground">Прогноз — среднее по дню недели за 12 недель с поправкой на темп последнего месяца; никогда не ниже уже подтверждённых броней.</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Нет данных</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} width={44} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(l) => shortDay(String(l))}
                    formatter={(v: number | [number, number], name: string) => {
                      if (Array.isArray(v)) return [`${fmt(v[0])} – ${fmt(v[1])}`, "Коридор"];
                      const labels: Record<string, string> = { actual: "Факт", forecast: "Прогноз", confirmed: "Подтверждено" };
                      return [fmt(v), labels[name] ?? name];
                    }}
                  />
                  <ReferenceLine x={today} stroke="#ff3b30" strokeDasharray="3 3" label={{ value: "сегодня", position: "insideTopRight", fontSize: 11, fill: "#ff3b30" }} />
                  <Area type="monotone" dataKey="band" stroke="none" fill="var(--color-primary)" fillOpacity={0.12} isAnimationActive={false} />
                  <Line type="monotone" dataKey="actual" stroke="var(--color-primary)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }} />
                  <Line type="monotone" dataKey="forecast" stroke="var(--color-primary)" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }} />
                  <Line type="monotone" dataKey="confirmed" stroke="transparent" dot={false} activeDot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Спросить AI */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Спросить AI
            </CardTitle>
            <p className="text-[12.5px] text-muted-foreground">Вопрос простыми словами — ответ по цифрам выбранного периода и филиала. Работает без интернета и API.</p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <div className="flex-1 space-y-3 overflow-y-auto" style={{ maxHeight: 320 }}>
              {chat.length === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      disabled={ask.isPending}
                      className="rounded-full bg-secondary/70 px-3 py-1.5 text-left text-[12.5px] text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[92%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed",
                      m.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary/70 text-foreground"
                    )}
                  >
                    {m.text}
                    {m.role === "assistant" && (
                      <div className="mt-1.5 text-[10.5px] text-muted-foreground">{m.engine === "claude" ? m.model ?? "Claude" : "локальный аналитик"}</div>
                    )}
                  </div>
                </div>
              ))}
              {chat.length > 0 && chat[chat.length - 1].role === "assistant" && (chat[chat.length - 1].followUps?.length ?? 0) > 0 && !ask.isPending && (
                <div className="flex flex-wrap gap-1.5">
                  {chat[chat.length - 1].followUps!.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="rounded-full bg-secondary/70 px-3 py-1.5 text-left text-[12.5px] text-foreground transition-colors hover:bg-secondary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {ask.isPending && (
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Считаю по данным…
                </div>
              )}
              {askError && <div className="tint-rose rounded-2xl px-3.5 py-3 text-[13px]">{askError}</div>}
              <div ref={chatEndRef} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(question);
              }}
              className="flex items-center gap-2"
            >
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Например: почему упала загрузка в будни?" maxLength={600} className="h-10 rounded-full px-4" />
              <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!question.trim() || ask.isPending} aria-label="Спросить">
                {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Инсайты */}
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">Что важно прямо сейчас</h2>
          <p className="text-[13px] text-muted-foreground">Риски и возможности по приоритету — из ваших броней, кассы и прогноза.</p>
        </div>
        {data && <span className="text-[12.5px] text-muted-foreground">{data.insights.length} из 8</span>}
      </div>
      {isLoading ? (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : (data?.insights.length ?? 0) === 0 ? (
        <Card className="mb-6">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <p className="text-[15px] font-semibold text-foreground">Отклонений не найдено</p>
            <p className="max-w-sm text-[13.5px] text-muted-foreground">Загрузка, отмены, долги и каналы в норме. Попробуйте другой период или филиал.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data!.insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </div>
      )}

      {/* Профиль недели + каналы */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Средняя загрузка по дням недели</CardTitle>
            <p className="text-[12.5px] text-muted-foreground">За последние 12 недель — на этом же профиле строится прогноз.</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data?.weekdays ?? []} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
                    formatter={(v: number) => [`${v}%`, "Загрузка"]}
                  />
                  <Bar dataKey="avgOccupancy" radius={[6, 6, 0, 0]} barSize={28}>
                    {(data?.weekdays ?? []).map((w) => (
                      <Cell key={w.weekday} fill={w.weekday === 5 || w.weekday === 6 ? (theme === "dark" ? "#409cff" : "#0a52b8") : "var(--color-primary)"} fillOpacity={w.weekday === 5 || w.weekday === 6 ? 1 : 0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Каналы бронирования за период</CardTitle>
            <p className="text-[12.5px] text-muted-foreground">Доля выручки по источникам.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (data?.sources.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Нет броней за период</p>
            ) : (
              data!.sources.slice(0, 6).map((s) => (
                <div key={s.name}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="font-medium text-foreground">{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {fmt(s.total)} · {s.share}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${s.share}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
