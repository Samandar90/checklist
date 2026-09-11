import { Insight, Rule } from "../core/types";
import { fmtSigned, fmtDayWithWeekday, lc } from "../core/format";

/*
 * Domain-agnostic insight rules. A host picks the ones that make sense and
 * adds its own; every rule gets a RuleContext and returns zero or more
 * insights. Kept small on purpose — the interesting rules are domain rules.
 */

/** Headline metric moved ≥ `threshold`% against the previous period. */
export function deltaRule(metricKey: string, threshold = 10): Rule {
  return (ctx) => {
    const m = ctx.metric(metricKey);
    if (!m) return null;
    const cur = ctx.value(metricKey);
    const prev = ctx.value(metricKey, ctx.prevRange);
    if (cur === null || prev === null) return null;
    const d = m.unit === "percent" ? cur - prev : ctx.deltaPct(cur, prev);
    if (d === null || Math.abs(d) < threshold) return null;
    const up = d > 0;
    const good = (m.higherIsBetter ?? true) === up;
    const unit = m.unit === "percent" ? " п.п." : "%";
    return {
      id: `delta:${metricKey}`,
      kind: good ? "trend" : "risk",
      severity: good ? "good" : Math.abs(d) >= threshold * 2.5 ? "critical" : "warning",
      title: `${m.label} ${up ? "выросла" : "снизилась"} на ${fmtSigned(Math.abs(d), unit).replace("+", "")}`.replace(/(ADR|RevPAR) (выросла|снизилась)/, (_, a, v) => `${a} ${v === "выросла" ? "вырос" : "снизился"}`),
      detail: `${ctx.fmt(metricKey, cur)} против ${ctx.fmt(metricKey, prev)} за предыдущий период той же длины.`,
      metric: fmtSigned(d, unit),
      tags: [metricKey],
    } satisfies Insight;
  };
}

/** The most unusual day of the period, if any. */
export function anomalyRule(metricKey: string): Rule {
  return (ctx) => {
    const m = ctx.metric(metricKey);
    const a = ctx.anomalies(metricKey)[0];
    if (!m || !a) return null;
    const up = a.value > a.expected;
    return {
      id: `anomaly:${metricKey}`,
      kind: "anomaly",
      severity: up ? "good" : "warning",
      title: `Необычный день — ${fmtDayWithWeekday(a.date)}`,
      detail: `${m.label}: ${ctx.fmt(metricKey, a.value)} при обычных ${ctx.fmt(metricKey, a.expected)} для этого дня недели (${a.zscore > 0 ? "+" : ""}${a.zscore}σ). ${up ? "Стоит понять причину и повторить." : "Проверьте, что пошло не так в этот день."}`,
      metric: `${a.zscore > 0 ? "+" : ""}${a.zscore}σ`,
      tags: [metricKey],
    } satisfies Insight;
  };
}

/** One dimension value carries ≥ `threshold`% of an additive metric. */
export function concentrationRule(metricKey: string, dim: string, threshold = 60): Rule {
  return (ctx) => {
    const m = ctx.metric(metricKey);
    if (!m) return null;
    const g = ctx.groups(metricKey, dim);
    if (g.length < 2 || g[0].share === undefined || g[0].share < threshold) return null;
    return {
      id: `concentration:${metricKey}:${dim}`,
      kind: "risk",
      severity: "neutral",
      title: `Зависимость от «${g[0].key}» — ${g[0].share}% ${lc(m.label)}`,
      detail: `Один источник даёт больше половины. Если его условия изменятся, пострадает всё — развивайте второй (${g[1].key}, ${g[1].share}%).`,
      metric: `${g[0].share}%`,
      tags: [metricKey],
    } satisfies Insight;
  };
}

/** Next 14 days forecast vs the last 14 days. */
export function forecastRule(metricKey: string, threshold = 15): Rule {
  return (ctx) => {
    const m = ctx.metric(metricKey);
    if (!m) return null;
    const fc = ctx.forecast(metricKey, 14);
    if (!fc.length) return null;
    const total = fc.reduce((s, p) => s + p.value, 0);
    const last = ctx.value(metricKey, { from: ctx.today.slice(0, 8) + "01", to: ctx.today });
    const d = ctx.deltaPct(total, last);
    if (d === null || Math.abs(d) < threshold) return null;
    const down = d < 0;
    return {
      id: `forecast:${metricKey}`,
      kind: down ? "risk" : "opportunity",
      severity: down ? "warning" : "good",
      title: `Впереди ${down ? "слабее" : "сильнее"}: прогноз ${lc(m.label)} ${fmtSigned(d)}`,
      detail: `На ближайшие 14 дней ожидается ${ctx.fmt(metricKey, total)} против ${ctx.fmt(metricKey, last)} с начала месяца. ${down ? "Самое время для акции с ограниченным сроком." : "Держите цены выше средних на пиковые даты."}`,
      metric: fmtSigned(d),
      tags: [metricKey],
    } satisfies Insight;
  };
}

/** A sensible default set for any domain with a money metric and one dimension. */
export function genericRules(metricKey: string, dim?: string): Rule[] {
  const rules = [deltaRule(metricKey), anomalyRule(metricKey), forecastRule(metricKey)];
  if (dim) rules.push(concentrationRule(metricKey, dim));
  return rules;
}
