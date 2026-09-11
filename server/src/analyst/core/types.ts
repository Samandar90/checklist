/*
 * Public types of the local analyst engine. Nothing here depends on any
 * framework, database or network — the engine is a pure library that a host
 * application feeds with facts and asks questions.
 */

export type Unit = "money" | "percent" | "count" | "number";
export type Gender = "m" | "f" | "n";

export interface MetricDef {
  /** Stable id, e.g. "revenue". */
  key: string;
  /** Display label in the nominative, e.g. "Выручка". */
  label: string;
  /** Accusative ("поднять выручку"); derived from `label` when omitted. */
  labelAcc?: string;
  unit: Unit;
  /** Words and phrases users say for this metric (any grammatical form). */
  synonyms: string[];
  /** "sum" (default) adds a fact measure; "formula" derives from summed measures. */
  kind?: "sum" | "formula";
  /** Fact measure to sum (defaults to `key`). */
  measure?: string;
  /** Measures a formula needs summed before `compute` runs. */
  deps?: string[];
  /** Derive the value from summed measures; return null when undefined (0/0). */
  compute?: (sums: Record<string, number>) => number | null;
  /** false for costs, debts, cancellations — growth is bad. Default true. */
  higherIsBetter?: boolean;
  /** Metric keys whose movement explains this one (used by "why" answers). */
  drivers?: string[];
  /** Word forms for counts: ["бронь", "брони", "броней"]. */
  nounForms?: [string, string, string];
  /** Grammatical gender of `label`, for verb agreement. Auto-detected when omitted. */
  gender?: Gender;
  /** Gender of `nounForms[0]` ("бронь" → f, "заказ" → m). Auto-detected when omitted. */
  nounGender?: Gender;
  decimals?: number;
  /** Mentioned in the narrative summary. */
  headline?: boolean;
}

export interface DimensionDef {
  key: string;
  /** "Канал" */
  label: string;
  /** Dative plural for "по каналам". */
  labelPlural: string;
  synonyms: string[];
}

export interface Fact {
  /** YYYY-MM-DD */
  date: string;
  dims?: Record<string, string>;
  measures: Record<string, number>;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface Filter {
  dims?: Record<string, string | string[]>;
  /** 0 = Sunday … 6 = Saturday. */
  weekdays?: number[];
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface GroupValue {
  key: string;
  value: number;
  /** 0–100 share of the total, for additive metrics only. */
  share?: number;
}

export interface ForecastPoint {
  date: string;
  value: number;
  /** Already committed for that day (the estimate never goes below it). */
  floor: number;
  low: number;
  high: number;
}

export interface Anomaly {
  date: string;
  value: number;
  expected: number;
  zscore: number;
}

export interface WeekdayPoint {
  weekday: number;
  label: string;
  value: number;
}

export interface TrendInfo {
  slopePerDay: number;
  /** Slope over a week as % of the mean. */
  weeklyPct: number;
  r2: number;
  direction: "up" | "down" | "flat";
}

export type InsightKind = "risk" | "opportunity" | "anomaly" | "trend" | "info";
export type InsightSeverity = "critical" | "warning" | "good" | "neutral";
export interface Insight {
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  detail: string;
  metric?: string;
  link?: string;
  /** Metric keys this insight is about — lets "what to do about X" pick it up. */
  tags?: string[];
}

export interface Advice {
  id: string;
  text: string;
  /** Metric keys (or "general") this advice helps with. */
  tags: string[];
  when?: (ctx: RuleContext) => boolean;
  priority?: number;
}

export interface RuleContext {
  range: DateRange;
  prevRange: DateRange;
  today: string;
  config: AnalystConfig;
  metric(key: string): MetricDef | undefined;
  value(metric: string, range?: DateRange, filter?: Filter): number | null;
  series(metric: string, range?: DateRange, filter?: Filter): SeriesPoint[];
  groups(metric: string, dim: string, range?: DateRange, filter?: Filter): GroupValue[];
  forecast(metric: string, days?: number, filter?: Filter): ForecastPoint[];
  anomalies(metric: string, range?: DateRange, filter?: Filter): Anomaly[];
  weekdayProfile(metric: string, filter?: Filter): WeekdayPoint[];
  fmt(metric: string, value: number | null): string;
  deltaPct(current: number | null, previous: number | null): number | null;
}

export type Rule = (ctx: RuleContext) => Insight | Insight[] | null | undefined;

export interface AnalystConfig {
  /** How the domain calls itself in answers, e.g. "отель", "магазин". */
  name?: string;
  currency?: string;
  metrics: MetricDef[];
  dimensions?: DimensionDef[];
  /** Metric assumed when a question names none (default: first headline metric). */
  defaultMetric?: string;
  /** Dimension used for "which X contributed most" when none is named. */
  primaryDimension?: string;
  /** Human labels for raw fact measures that are not metrics themselves ("visits" → "визитов"). */
  measureLabels?: Record<string, string>;
  rules?: Rule[];
  advice?: Advice[];
  /** Override the clock (tests, fixed reports). */
  today?: () => Date;
}

export type Intent =
  | "value"
  | "why"
  | "rank"
  | "forecast"
  | "weakDays"
  | "strongDays"
  | "trend"
  | "anomaly"
  | "recommend"
  | "summary"
  | "compareMetrics"
  | "help"
  | "unknown";

export interface Answer {
  text: string;
  intent: Intent;
  /** 0–1: how sure the parser is that it understood the question. */
  confidence: number;
  followUps: string[];
  metric?: string;
  data?: unknown;
}
