import {
  Advice,
  AnalystConfig,
  Anomaly,
  Answer,
  DateRange,
  DimensionDef,
  Filter,
  ForecastPoint,
  Gender,
  GroupValue,
  Insight,
  InsightSeverity,
  MetricDef,
  RuleContext,
  SeriesPoint,
  WeekdayPoint,
  Fact,
} from "./core/types";
import { BUILTIN_DIMENSIONS, Dataset } from "./core/dataset";
import { addDays, previousRange, rangeEndingAt, rangeStartingAt, toIso, daysInclusive } from "./core/dates";
import { daysWord, fmtMetric, fmtMoney, fmtNumber, fmtSigned, lc, plural } from "./core/format";
import { deltaPct, detectAnomalies, forecastSeries, linearTrend, trendFactor, weekdayProfile } from "./core/stats";
import { parseQuestion, Query } from "./nlu/parse";
import { composeAnswer } from "./answer/compose";

/*
 * The local analyst. Feed it facts, ask it questions in Russian, get prose
 * answers with the numbers behind them. No network, no model, no
 * dependencies — everything is rules + statistics, which also means every
 * answer can be traced back to a formula.
 *
 *   const analyst = new Analyst(config).load(facts);
 *   analyst.ask("почему упала выручка в сентябре?").text
 *   analyst.narrative()
 *   analyst.insights()
 */

const SEVERITY_RANK: Record<InsightSeverity, number> = { critical: 0, warning: 1, good: 2, neutral: 3 };
const HISTORY_DAYS = 84;

export interface AskOptions {
  /** The period the user is currently looking at; questions without a period use it. */
  range?: DateRange;
  today?: string;
  /** Insights computed elsewhere (e.g. by the host's own rules) to quote in advice and summaries. */
  insights?: Insight[];
}

export class Analyst {
  readonly config: AnalystConfig;
  readonly metrics: MetricDef[];
  readonly dimensions: DimensionDef[];
  dataset: Dataset;
  private readonly metricsByKey: Map<string, MetricDef>;
  private readonly dimsByKey: Map<string, DimensionDef>;

  constructor(config: AnalystConfig) {
    if (!config.metrics.length) throw new Error("Analyst: at least one metric is required");
    this.config = config;
    this.metrics = config.metrics;
    this.metricsByKey = new Map(config.metrics.map((m) => [m.key, m]));
    const own = config.dimensions ?? [];
    this.dimensions = [...own, ...BUILTIN_DIMENSIONS.filter((b) => !own.some((d) => d.key === b.key))];
    this.dimsByKey = new Map(this.dimensions.map((d) => [d.key, d]));
    this.dataset = new Dataset([], this.metricsByKey);
  }

  load(facts: Fact[]): this {
    this.dataset = new Dataset(facts, this.metricsByKey);
    return this;
  }

  // ---------- lookups ----------

  metric(key: string): MetricDef | undefined {
    return this.metricsByKey.get(key);
  }
  dimension(key: string): DimensionDef | undefined {
    return this.dimsByKey.get(key);
  }
  defaultMetric(): MetricDef {
    return (this.config.defaultMetric && this.metric(this.config.defaultMetric)) || this.metrics.find((m) => m.headline) || this.metrics[0];
  }
  /** Metric used for "weak / strong days": a percent metric if any, else the default. */
  daysMetric(): MetricDef {
    return this.metrics.find((m) => m.unit === "percent" && (m.higherIsBetter ?? true)) ?? this.defaultMetric();
  }
  /** The count metric that pairs with a money metric (revenue ↔ bookings). */
  countMetricFor(m: MetricDef): string | undefined {
    if (m.unit !== "money") return undefined;
    const declared = m.drivers?.find((d) => this.metric(d)?.unit === "count");
    return declared ?? this.metrics.find((x) => x.unit === "count" && x.kind !== "formula" && (x.higherIsBetter ?? true))?.key;
  }
  measureLabel(measure: string): string {
    const m = this.metrics.find((x) => (x.measure ?? x.key) === measure && x.kind !== "formula");
    return m?.label ?? this.config.measureLabels?.[measure] ?? measure;
  }
  /** "одну бронь" / "один заказ" — accusative with the numeral, for "на одну …". */
  oneOf(m: MetricDef): string {
    const noun = m.nounForms?.[0];
    if (!noun) return `единицу («${lc(m.label)}»)`;
    const g: Gender = m.nounGender ?? (/[ая]$/.test(noun) ? "f" : /[ое]$/.test(noun) ? "n" : /ь$/.test(noun) ? "f" : "m");
    if (g === "f") return `одну ${noun.replace(/а$/, "у").replace(/я$/, "ю")}`;
    if (g === "n") return `одно ${noun}`;
    return `один ${noun}`;
  }

  today(): string {
    return toIso(this.config.today ? this.config.today() : new Date());
  }
  defaultRange(today = this.today()): DateRange {
    return rangeEndingAt(today, 30);
  }

  // ---------- numbers ----------

  fmt(metricKey: string, value: number | null): string {
    const m = this.metric(metricKey);
    return m ? fmtMetric(m, value, this.config.currency) : value === null ? "—" : fmtNumber(value);
  }
  fmtNumberLike(n: number): string {
    return Math.abs(n) >= 10_000 ? fmtMoney(n) : fmtNumber(n);
  }
  fmtDeltaValue(m: MetricDef, delta: number): string {
    if (m.unit === "money") return `${delta < 0 ? "−" : "+"}${fmtMoney(Math.abs(delta), this.config.currency)}`;
    if (m.unit === "percent") return fmtSigned(delta, " п.п.");
    if (m.unit === "count" && m.nounForms) return `${delta < 0 ? "−" : "+"}${fmtNumber(Math.abs(delta))} ${plural(delta, m.nounForms)}`;
    return fmtSigned(delta, "");
  }

  value(metricKey: string, range: DateRange, filter?: Filter): number | null {
    return this.dataset.value(metricKey, range, filter);
  }
  series(metricKey: string, range: DateRange, filter?: Filter): SeriesPoint[] {
    return this.dataset.series(metricKey, range, filter);
  }
  groups(metricKey: string, dim: string, range: DateRange, filter?: Filter): GroupValue[] {
    return this.dataset.groups(metricKey, dim, range, filter);
  }

  /** History window used by forecasts, anomalies and weekday profiles. */
  historyRange(today = this.today()): DateRange {
    return { from: addDays(today, -HISTORY_DAYS), to: addDays(today, -1) };
  }

  forecast(metricKey: string, days = 14, today = this.today(), filter?: Filter): ForecastPoint[] {
    const m = this.metric(metricKey);
    if (!m) return [];
    const history = this.series(metricKey, this.historyRange(today), filter);
    const future = this.series(metricKey, rangeStartingAt(addDays(today, 1), days), filter);
    // Momentum comes from the domain's default (money) metric, so a ratio like
    // occupancy inherits the same demand trend as revenue.
    const trend = trendFactor(this.series(this.defaultMetric().key, this.historyRange(today), filter));
    return forecastSeries(history, future, { trend, max: m.unit === "percent" ? 100 : undefined });
  }

  anomalies(metricKey: string, range: DateRange, filter?: Filter): Anomaly[] {
    // Baseline is the 12-week history; report only anomalies inside `range`.
    const hist = this.historyRange(this.today());
    const from = range.from < hist.from ? range.from : hist.from;
    const to = range.to > hist.to ? range.to : hist.to;
    const all = detectAnomalies(this.series(metricKey, { from, to }, filter), { limit: 50 });
    return all.filter((a) => a.date >= range.from && a.date <= range.to).slice(0, 5);
  }

  weekdayProfile(metricKey: string, today = this.today(), filter?: Filter): WeekdayPoint[] {
    return weekdayProfile(this.series(metricKey, this.historyRange(today), filter));
  }

  trend(metricKey: string, range: DateRange, filter?: Filter) {
    return linearTrend(this.series(metricKey, range, filter));
  }

  // ---------- rules & advice ----------

  ruleContext(range: DateRange, today = this.today()): RuleContext {
    return {
      range,
      prevRange: previousRange(range),
      today,
      config: this.config,
      metric: (k) => this.metric(k),
      value: (k, r = range, f) => this.value(k, r, f),
      series: (k, r = range, f) => this.series(k, r, f),
      groups: (k, d, r = range, f) => this.groups(k, d, r, f),
      forecast: (k, days = 14, f) => this.forecast(k, days, today, f),
      anomalies: (k, r = range, f) => this.anomalies(k, r, f),
      weekdayProfile: (k, f) => this.weekdayProfile(k, today, f),
      fmt: (k, v) => this.fmt(k, v),
      deltaPct,
    };
  }

  insights(opts: { range?: DateRange; today?: string; limit?: number } = {}): Insight[] {
    const today = opts.today ?? this.today();
    const ctx = this.ruleContext(opts.range ?? this.defaultRange(today), today);
    const out: Insight[] = [];
    for (const rule of this.config.rules ?? []) {
      const r = rule(ctx);
      if (!r) continue;
      for (const i of Array.isArray(r) ? r : [r]) out.push(i);
    }
    out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
    return out.slice(0, opts.limit ?? 8);
  }

  advice(tags: string[], range: DateRange, today = this.today()): Advice[] {
    const ctx = this.ruleContext(range, today);
    return (this.config.advice ?? [])
      .filter((a) => a.tags.some((t) => tags.includes(t)))
      .filter((a) => !a.when || a.when(ctx))
      .sort((x, y) => (y.priority ?? 0) - (x.priority ?? 0));
  }

  // ---------- prose ----------

  narrative(opts: AskOptions & { rangeLabel?: string } = {}): string {
    const today = opts.today ?? this.today();
    const range = opts.range ?? this.defaultRange(today);
    const prev = previousRange(range);
    const insights = opts.insights ?? this.insights({ range, today });
    const days = daysInclusive(range.from, range.to);
    const label = opts.rangeLabel ?? (range.from === this.defaultRange(today).from && range.to === this.defaultRange(today).to ? `за последние ${daysWord(days)}` : `за ${daysWord(days)} до ${range.to.split("-").reverse().join(".")}`);

    const heads = this.metrics.filter((m) => m.headline);
    const parts: string[] = [];
    for (const m of heads.slice(0, 4)) {
      const cur = this.value(m.key, range);
      if (cur === null) continue;
      const p = this.value(m.key, prev);
      let s = `${lc(m.label)} ${this.fmt(m.key, cur)}`;
      if (p !== null && p !== 0) {
        const d = m.unit === "percent" ? cur - p : deltaPct(cur, p);
        if (d !== null && Math.abs(d) >= 1) s += ` (${m.unit === "percent" ? fmtSigned(d, " п.п.") : fmtSigned(d)})`;
      }
      parts.push(s);
    }
    const lines: string[] = [];
    if (parts.length) lines.push(`${label[0].toUpperCase()}${label.slice(1)}: ${parts.join(", ")}.`);
    else lines.push(`${label[0].toUpperCase()}${label.slice(1)} данных нет.`);

    const dm = this.defaultMetric();
    const t = this.trend(dm.key, range);
    if (t.direction !== "flat" && days >= 7) lines.push(`Динамика: ${lc(dm.label)} ${t.direction === "up" ? "растёт" : "снижается"} примерно на ${fmtSigned(Math.abs(t.weeklyPct)).replace("+", "")} в неделю.`);

    const risk = insights.find((i) => i.kind === "risk");
    const opp = insights.find((i) => i.kind === "opportunity" || i.kind === "trend");
    if (risk) lines.push(`Главный риск — ${lc(risk.title)}. ${firstSentenceOf(risk.detail)}`);
    if (opp) lines.push(`Возможность — ${lc(opp.title)}. ${firstSentenceOf(opp.detail)}`);
    if (!risk && !opp) lines.push("Отклонений от нормы не видно — период прошёл ровно.");

    const fc = this.forecast(dm.key, 14, today);
    if (fc.length) {
      const total = fc.reduce((s, p) => s + p.value, 0);
      const last14 = this.value(dm.key, rangeEndingAt(today, 14));
      const d = deltaPct(total, last14);
      const confirmed = fc.reduce((s, p) => s + p.floor, 0);
      let s = `Прогноз на 14 дней: ${lc(dm.label)} ${this.fmt(dm.key, total)}`;
      if (d !== null && Math.abs(d) >= 1) s += ` — ${fmtSigned(d)} к последним двум неделям`;
      if (confirmed > 0) s += `; подтверждено ${Math.round((confirmed / Math.max(total, 1)) * 100)}%`;
      lines.push(s + ".");
    }

    const action = this.advice([risk?.tags?.[0] ?? dm.key, "general"], range, today)[0]?.text ?? (risk ? lastSentenceOf(risk.detail) : undefined);
    if (action) lines.push(`Действие на неделю: ${lc(action)}`);
    return lines.join(" ");
  }

  parse(question: string, today = this.today()): Query {
    return parseQuestion(question, {
      metrics: this.metrics,
      dimensions: this.dimensions,
      dimensionValues: (d) => this.dataset.dimensionValues(d),
      today,
    });
  }

  ask(question: string, opts: AskOptions = {}): Answer {
    const today = opts.today ?? this.today();
    const q = this.parse(question, today);
    const range = q.range && !(q.range.from > today) ? q.range : opts.range ?? this.defaultRange(today);
    const insights = opts.insights ?? this.insights({ range, today });
    const answer = composeAnswer(this, q, { range, today, insights });
    return { ...answer, data: answer.data, followUps: answer.followUps };
  }
}

function firstSentenceOf(s: string): string {
  const i = s.search(/[.!?](\s|$)/);
  return i > 0 ? s.slice(0, i + 1) : s;
}
function lastSentenceOf(s: string): string {
  const parts = s.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? s;
}
