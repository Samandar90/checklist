import { Anomaly, ForecastPoint, SeriesPoint, TrendInfo, WeekdayPoint } from "./types";
import { weekdayOf } from "./dates";
import { WEEKDAY_SHORT } from "./format";

/*
 * Statistics over daily series. Every method is deliberately simple and
 * explainable — the answers quote these numbers, so a human must be able to
 * check them: weekday means, momentum, a z-score against the same weekday,
 * least-squares trend. No black boxes.
 */

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
export const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);
export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export interface WeekdayStat {
  n: number;
  mean: number;
  std: number;
}

/** Per-weekday mean and standard deviation (index 0 = Sunday). */
export function weekdayStats(series: SeriesPoint[]): WeekdayStat[] {
  const buckets: number[][] = Array.from({ length: 7 }, () => []);
  for (const p of series) buckets[weekdayOf(p.date)].push(p.value);
  return buckets.map((xs) => ({ n: xs.length, mean: mean(xs), std: std(xs) }));
}

/**
 * Momentum: the last 4 weeks over the 4 weeks before them, clamped to
 * [0.6, 1.6] so a single freak week cannot double a forecast. Needs 6 weeks.
 */
export function trendFactor(series: SeriesPoint[]): number {
  if (series.length < 42) return 1;
  const last = series.slice(-28).map((p) => p.value);
  const prev = series.slice(-56, -28).map((p) => p.value);
  if (prev.length < 14) return 1;
  const base = mean(prev);
  if (base <= 0) return 1;
  return clamp(mean(last) / base, 0.6, 1.6);
}

/**
 * Weekday-seasonal forecast: same-weekday mean × momentum, never below what
 * is already committed for the day (`future[i].value`), with a ±1σ band.
 */
export function forecastSeries(
  history: SeriesPoint[],
  future: SeriesPoint[],
  opts: { trend?: number; max?: number } = {}
): ForecastPoint[] {
  const wd = weekdayStats(history);
  const trend = opts.trend ?? trendFactor(history);
  return future.map((p) => {
    const s = wd[weekdayOf(p.date)];
    const stat = s.n ? s.mean * trend : 0;
    const spread = s.n > 1 ? s.std * trend : stat * 0.3;
    const floor = p.value;
    let value = Math.max(stat, floor);
    let low = Math.max(floor, stat - spread, 0);
    let high = Math.max(value, stat + spread);
    if (opts.max !== undefined) {
      value = Math.min(opts.max, value);
      low = Math.min(opts.max, low);
      high = Math.min(opts.max, high);
    }
    return { date: p.date, value, floor, low, high };
  });
}

/** Days at least `threshold` σ away from their weekday mean, most unusual first. */
export function detectAnomalies(series: SeriesPoint[], opts: { threshold?: number; minSamples?: number; limit?: number } = {}): Anomaly[] {
  const threshold = opts.threshold ?? 2;
  const minSamples = opts.minSamples ?? 3;
  const wd = weekdayStats(series);
  const out: Anomaly[] = [];
  for (const p of series) {
    const s = wd[weekdayOf(p.date)];
    if (s.n < minSamples || s.std <= 0) continue;
    const z = (p.value - s.mean) / s.std;
    if (Math.abs(z) >= threshold) out.push({ date: p.date, value: p.value, expected: s.mean, zscore: Math.round(z * 10) / 10 });
  }
  out.sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore));
  return opts.limit ? out.slice(0, opts.limit) : out;
}

/** Monday-first weekday averages. */
export function weekdayProfile(series: SeriesPoint[]): WeekdayPoint[] {
  const wd = weekdayStats(series);
  return [1, 2, 3, 4, 5, 6, 0].map((i) => ({ weekday: i, label: WEEKDAY_SHORT[i], value: wd[i].mean }));
}

/** Least-squares line through the series; direction needs a visible slope and some fit. */
export function linearTrend(series: SeriesPoint[]): TrendInfo {
  const n = series.length;
  if (n < 3) return { slopePerDay: 0, weeklyPct: 0, r2: 0, direction: "flat" };
  const xs = series.map((_, i) => i);
  const ys = series.map((p) => p.value);
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const slope = sxx ? sxy / sxx : 0;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
  const weeklyPct = my > 0 ? (slope * 7 * 100) / my : 0;
  const direction: TrendInfo["direction"] = Math.abs(weeklyPct) < 3 || r2 < 0.1 ? "flat" : slope > 0 ? "up" : "down";
  return { slopePerDay: slope, weeklyPct, r2, direction };
}

export function deltaPct(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
