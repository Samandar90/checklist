import { DateRange, DimensionDef, Fact, Filter, GroupValue, MetricDef, SeriesPoint } from "./types";
import { listDays, weekdayOf } from "./dates";
import { MONTHS_NOM, WEEKDAY_FULL } from "./format";

/*
 * A small in-memory fact table: rows of {date, dims, measures}. Metrics are
 * either summed measures or formulas over summed measures, so every question
 * reduces to "sum these measures over these days for these dimension values".
 *
 * Two dimensions are always available without the host declaring them:
 * `weekday` and `month`, derived from the fact date.
 */

export const BUILTIN_DIMENSIONS: DimensionDef[] = [
  { key: "weekday", label: "День недели", labelPlural: "дням недели", synonyms: ["день недели", "дням недели", "дни недели", "по дням"] },
  { key: "month", label: "Месяц", labelPlural: "месяцам", synonyms: ["по месяцам", "месяцам", "помесячно"] },
];

export class Dataset {
  private byDate = new Map<string, Fact[]>();
  private valuesByDim = new Map<string, Set<string>>();

  constructor(facts: Fact[], private readonly metrics: Map<string, MetricDef>) {
    for (const f of facts) {
      let list = this.byDate.get(f.date);
      if (!list) this.byDate.set(f.date, (list = []));
      list.push(f);
      if (f.dims) {
        for (const [k, v] of Object.entries(f.dims)) {
          let set = this.valuesByDim.get(k);
          if (!set) this.valuesByDim.set(k, (set = new Set()));
          set.add(v);
        }
      }
    }
  }

  get size(): number {
    let n = 0;
    for (const l of this.byDate.values()) n += l.length;
    return n;
  }

  dimensionValues(dim: string): string[] {
    return [...(this.valuesByDim.get(dim) ?? [])];
  }

  static dimOf(fact: Fact, dim: string): string | undefined {
    if (dim === "weekday") return WEEKDAY_FULL[weekdayOf(fact.date)];
    if (dim === "month") return MONTHS_NOM[Number(fact.date.slice(5, 7)) - 1];
    return fact.dims?.[dim];
  }

  private matches(fact: Fact, filter?: Filter): boolean {
    if (!filter) return true;
    if (filter.weekdays && !filter.weekdays.includes(weekdayOf(fact.date))) return false;
    if (filter.dims) {
      for (const [k, want] of Object.entries(filter.dims)) {
        const have = Dataset.dimOf(fact, k);
        if (have === undefined) return false;
        if (Array.isArray(want) ? !want.includes(have) : have !== want) return false;
      }
    }
    return true;
  }

  private measuresOf(metric: MetricDef): string[] {
    return metric.kind === "formula" ? metric.deps ?? [] : [metric.measure ?? metric.key];
  }

  private evaluate(metric: MetricDef, sums: Record<string, number>): number | null {
    if (metric.kind === "formula") return metric.compute ? metric.compute(sums) : null;
    return sums[metric.measure ?? metric.key] ?? 0;
  }

  /** Summed measures over the range. */
  sums(measures: string[], range: DateRange, filter?: Filter): Record<string, number> {
    const out: Record<string, number> = {};
    for (const m of measures) out[m] = 0;
    for (const day of listDays(range.from, range.to)) {
      const facts = this.byDate.get(day);
      if (!facts) continue;
      for (const f of facts) {
        if (!this.matches(f, filter)) continue;
        for (const m of measures) out[m] += f.measures[m] ?? 0;
      }
    }
    return out;
  }

  value(metricKey: string, range: DateRange, filter?: Filter): number | null {
    const metric = this.metrics.get(metricKey);
    if (!metric) return null;
    return this.evaluate(metric, this.sums(this.measuresOf(metric), range, filter));
  }

  /** One point per day in the range (missing days are 0 / formula of zeros). */
  series(metricKey: string, range: DateRange, filter?: Filter): SeriesPoint[] {
    const metric = this.metrics.get(metricKey);
    if (!metric) return [];
    const measures = this.measuresOf(metric);
    return listDays(range.from, range.to).map((day) => {
      const sums: Record<string, number> = {};
      for (const m of measures) sums[m] = 0;
      for (const f of this.byDate.get(day) ?? []) {
        if (!this.matches(f, filter)) continue;
        for (const m of measures) sums[m] += f.measures[m] ?? 0;
      }
      return { date: day, value: this.evaluate(metric, sums) ?? 0 };
    });
  }

  /** Metric per dimension value, largest first; shares only for additive metrics. */
  groups(metricKey: string, dim: string, range: DateRange, filter?: Filter): GroupValue[] {
    const metric = this.metrics.get(metricKey);
    if (!metric) return [];
    const measures = this.measuresOf(metric);
    const acc = new Map<string, Record<string, number>>();
    for (const day of listDays(range.from, range.to)) {
      for (const f of this.byDate.get(day) ?? []) {
        if (!this.matches(f, filter)) continue;
        const g = Dataset.dimOf(f, dim);
        if (g === undefined) continue;
        let sums = acc.get(g);
        if (!sums) {
          sums = {};
          for (const m of measures) sums[m] = 0;
          acc.set(g, sums);
        }
        for (const m of measures) sums[m] += f.measures[m] ?? 0;
      }
    }
    const rows: GroupValue[] = [];
    for (const [key, sums] of acc) {
      const v = this.evaluate(metric, sums);
      if (v === null) continue;
      rows.push({ key, value: v });
    }
    if (metric.kind !== "formula") {
      const total = rows.reduce((s, r) => s + r.value, 0);
      for (const r of rows) r.share = total ? Math.round((r.value / total) * 100) : 0;
    }
    // Weekday groups read Monday-first; everything else by size.
    if (dim === "weekday") {
      const order = [1, 2, 3, 4, 5, 6, 0].map((i) => WEEKDAY_FULL[i]);
      rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    } else rows.sort((a, b) => b.value - a.value);
    return rows;
  }
}
