import type { Analyst } from "../engine";
import type { Query } from "../nlu/parse";
import { Advice, Answer, DateRange, Filter, Insight, Intent, MetricDef } from "../core/types";
import { daysInclusive, previousRange, rangeStartingAt, addDays } from "../core/dates";
import { accusative, agree, daysWord, fmtDayWithWeekday, fmtRange, fmtSigned, genderOf, joinList, lc, WEEKDAY_FULL } from "../core/format";
import { deltaPct, linearTrend, mean } from "../core/stats";

/*
 * Turns a parsed question plus the numbers into Russian prose. Each intent
 * has one composer; they share the small vocabulary below so answers sound
 * like one analyst. Every answer ends with follow-up questions the user can
 * click, which is how the conversation stays useful without a model.
 */

export interface ComposeOptions {
  range: DateRange;
  today: string;
  insights: Insight[];
}

const BULLET = "•";

function periodLabel(q: Query, range: DateRange, defaultRange: DateRange): string {
  if (q.rangeLabel) return q.rangeLabel;
  if (range.from === defaultRange.from && range.to === defaultRange.to) return `за последние ${daysWord(daysInclusive(range.from, range.to))}`;
  return `за ${fmtRange(range)}`;
}

function filterSuffix(q: Query): string {
  return q.filterLabels.length ? ` (${q.filterLabels.join(", ")})` : "";
}

/** "+12% к предыдущему периоду (21,9 млн)" or "на 6 п.п. ниже (было 54%)". */
function compareClause(a: Analyst, m: MetricDef, cur: number, prev: number | null): string {
  if (prev === null) return "";
  if (m.unit === "percent") {
    const diff = cur - prev;
    if (Math.abs(diff) < 0.5) return ` — на уровне предыдущего периода (${a.fmt(m.key, prev)})`;
    return ` — на ${Math.abs(Math.round(diff))} п.п. ${diff > 0 ? "выше" : "ниже"}, чем в предыдущем периоде (${a.fmt(m.key, prev)})`;
  }
  const d = deltaPct(cur, prev);
  if (d === null) return prev === 0 && cur > 0 ? " — в предыдущем периоде было 0" : "";
  if (Math.abs(d) < 1) return ` — столько же, сколько в предыдущем периоде`;
  return ` — это ${fmtSigned(d)} к предыдущему периоду (${a.fmt(m.key, prev)})`;
}

function goodOrBad(m: MetricDef, delta: number): "good" | "bad" | "flat" {
  if (Math.abs(delta) < 1) return "flat";
  const up = delta > 0;
  return (m.higherIsBetter ?? true) === up ? "good" : "bad";
}

function verbChange(m: MetricDef, delta: number): string {
  const g = genderOf(m);
  if (Math.abs(delta) < 1) return agree(g, ["не изменился", "не изменилась", "не изменилось"]);
  if (delta > 0) return agree(g, ["вырос", "выросла", "выросло"]);
  return agree(g, ["снизился", "снизилась", "снизилось"]);
}

/** "изменился / изменилась / изменилось" in agreement with the label. */
function verbChanged(m: MetricDef): string {
  return agree(genderOf(m), ["изменился", "изменилась", "изменилось"]);
}

function adviceFor(a: Analyst, metricKey: string | undefined, opts: ComposeOptions, limit = 3): string[] {
  const ctx = a.ruleContext(opts.range, opts.today);
  const tags = metricKey ? [metricKey, "general"] : ["general"];
  const list = (a.config.advice ?? [])
    .filter((ad) => ad.tags.some((t) => tags.includes(t)))
    .filter((ad) => !ad.when || ad.when(ctx))
    .sort((x, y) => (y.priority ?? 0) - (x.priority ?? 0));
  const fromInsights = opts.insights
    .filter((i) => (i.kind === "risk" || i.kind === "opportunity") && (!metricKey || !i.tags || i.tags.includes(metricKey)))
    .map((i) => `${i.title}: ${lastSentence(i.detail)}`);
  const strong = list.filter((ad) => (ad.priority ?? 0) > 1);
  const pool = strong.length || fromInsights.length ? strong : list;
  const out: string[] = [];
  for (const ad of pool) if (out.length < limit) out.push(ad.text);
  for (const s of fromInsights) if (out.length < limit && !out.includes(s)) out.push(s);
  return out;
}

/** "Что сделать: первая фраза со строчной. Вторая фраза как есть." */
function adviceLine(adv: string[]): string {
  return `Что сделать: ${lc(adv[0])}${adv.slice(1).map((s) => ` ${s}`).join("")}`;
}

function lastSentence(s: string): string {
  const parts = s.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? s;
}

function followUpsFor(a: Analyst, intent: Intent, m: MetricDef | undefined, q: Query): string[] {
  const dims = a.dimensions.filter((d) => d.key !== "weekday" && d.key !== "month");
  const dim = dims.find((d) => d.key === a.config.primaryDimension) ?? dims[0];
  const label = m ? lc(m.label) : lc(a.defaultMetric().label);
  const set = new Set<string>();
  const add = (s: string) => set.add(s);
  switch (intent) {
    case "value":
      add(`Почему ${label} ${verbChanged(m ?? a.defaultMetric())}?`);
      if (dim && !q.groupBy) add(`${m ? m.label : a.defaultMetric().label} по ${dim.labelPlural}`);
      add(`Прогноз: ${label} на 14 дней`);
      break;
    case "why":
      add(`Что сделать, чтобы улучшить ${lc(accusative(m ?? a.defaultMetric()))}?`);
      if (dim) add(`${m ? m.label : a.defaultMetric().label} по ${dim.labelPlural}`);
      add("Были ли необычные дни?");
      break;
    case "rank":
      add(`Почему ${label} ${verbChanged(m ?? a.defaultMetric())}?`);
      add(`Прогноз на 14 дней`);
      add(`Что делать, чтобы поднять ${lc(accusative(m ?? a.defaultMetric()))}?`);
      break;
    case "forecast":
    case "weakDays":
    case "strongDays":
      add("Какие дни впереди самые слабые?");
      add("Что сделать со слабыми днями?");
      add(`${a.defaultMetric().label} за прошлый месяц`);
      break;
    case "trend":
      add(`Почему ${label} меняется?`);
      add(`Прогноз ${label} на 2 недели`);
      break;
    case "anomaly":
      add("Почему так произошло?");
      add("Сводка за период");
      break;
    case "recommend":
      add("Какие дни впереди самые слабые?");
      if (dim) add(`Какой ${lc(dim.label)} приносит больше всего?`);
      add("Сводка за период");
      break;
    case "summary":
    case "compareMetrics":
      add("Почему изменилась выручка?");
      add("Что делать в первую очередь?");
      add("Прогноз на 14 дней");
      break;
    default:
      add("Сводка за период");
      add("Прогноз на 14 дней");
      add("Что делать в первую очередь?");
  }
  return [...set].slice(0, 3);
}

// ---------- composers ----------

export function composeValue(a: Analyst, q: Query, m: MetricDef, opts: ComposeOptions): Answer {
  const range = opts.range;
  const cur = a.value(m.key, range, q.filter);
  const label = periodLabel(q, range, a.defaultRange(opts.today));
  if (cur === null || (a.dataset.size === 0)) {
    return { text: `Нет данных по показателю «${lc(m.label)}» ${label}`, intent: "value", confidence: 0.8, followUps: followUpsFor(a, "value", m, q), metric: m.key };
  }
  const prev = a.value(m.key, previousRange(range), q.filter);
  let text = `${m.label} ${label}${filterSuffix(q)}: ${a.fmt(m.key, cur)}${compareClause(a, m, cur, prev)}.`;

  const dims = a.dimensions.filter((d) => d.key !== "weekday" && d.key !== "month");
  const dim = dims.find((d) => d.key === a.config.primaryDimension) ?? dims[0];
  if (dim && m.kind !== "formula" && cur > 0) {
    const groups = a.groups(m.key, dim.key, range, q.filter);
    if (groups.length > 1 && groups[0].share !== undefined) {
      text += ` Больше всего дал ${lc(dim.label)} «${groups[0].key}» — ${groups[0].share}%`;
      if (groups[1]) text += `, затем «${groups[1].key}» — ${groups[1].share}%`;
      text += ".";
    }
  }
  if (m.kind === "formula" && m.deps?.length === 2 && cur !== null) {
    const sums = a.dataset.sums(m.deps, range, q.filter);
    const parts = m.deps.map((d) => `${lc(a.measureLabel(d))} — ${a.fmtNumberLike(sums[d])}`);
    text += ` В основе: ${parts.join(" / ")}.`;
  }
  return { text, intent: "value", confidence: 0.9, followUps: followUpsFor(a, "value", m, q), metric: m.key, data: { value: cur, previous: prev } };
}

export function composeWhy(a: Analyst, q: Query, m: MetricDef, opts: ComposeOptions): Answer {
  const range = opts.range;
  const prevRange = previousRange(range);
  const cur = a.value(m.key, range, q.filter);
  const prev = a.value(m.key, prevRange, q.filter);
  const label = periodLabel(q, range, a.defaultRange(opts.today));
  if (cur === null || prev === null) {
    return { text: `Не с чем сравнивать: по показателю «${lc(m.label)}» нет данных за предыдущий период.`, intent: "why", confidence: 0.7, followUps: followUpsFor(a, "why", m, q), metric: m.key };
  }
  const d = m.unit === "percent" ? cur - prev : deltaPct(cur, prev);
  const lines: string[] = [];
  if (d === null || Math.abs(d) < 1) {
    lines.push(`${m.label} ${label} практически не изменилась: ${a.fmt(m.key, cur)} против ${a.fmt(m.key, prev)} в предыдущем периоде.`);
  } else if (m.unit === "percent") {
    lines.push(`${m.label} ${label} ${verbChange(m, d)} на ${Math.abs(Math.round(d))} п.п.: ${a.fmt(m.key, cur)} против ${a.fmt(m.key, prev)}.`);
  } else {
    lines.push(`${m.label} ${label} ${verbChange(m, d)} на ${fmtSigned(Math.abs(d)).replace("+", "")}: ${a.fmt(m.key, cur)} против ${a.fmt(m.key, prev)} в предыдущем периоде.`);
  }

  const bullets: string[] = [];

  // 1. Formula metrics: which component moved.
  if (m.kind === "formula" && m.deps?.length) {
    const s1 = a.dataset.sums(m.deps, range, q.filter);
    const s0 = a.dataset.sums(m.deps, prevRange, q.filter);
    const moved = m.deps
      .map((dep) => ({ dep, cur: s1[dep], prev: s0[dep], d: deltaPct(s1[dep], s0[dep]) }))
      .filter((x) => x.d !== null && Math.abs(x.d) >= 3)
      .sort((x, y) => Math.abs(y.d!) - Math.abs(x.d!));
    if (moved.length) {
      bullets.push(
        `Составляющие: ${moved
          .map((x) => `${lc(a.measureLabel(x.dep))} ${a.fmtNumberLike(x.cur)} против ${a.fmtNumberLike(x.prev)} (${fmtSigned(x.d!)})`)
          .join("; ")}.`
      );
    }
  }

  // 2. Additive metrics: volume × average, then the dimension that moved most.
  if (m.kind !== "formula") {
    const countKey = a.countMetricFor(m);
    if (countKey && countKey !== m.key) {
      const c1 = a.value(countKey, range, q.filter) ?? 0;
      const c0 = a.value(countKey, prevRange, q.filter) ?? 0;
      if (c0 > 0 && c1 > 0) {
        const avg1 = cur / c1;
        const avg0 = prev / c0;
        const volumeEffect = (c1 - c0) * avg0;
        const priceEffect = (avg1 - avg0) * c1;
        const cm = a.metric(countKey)!;
        const dc = deltaPct(c1, c0);
        const da = deltaPct(avg1, avg0);
        const main = Math.abs(volumeEffect) >= Math.abs(priceEffect) ? "volume" : "price";
        bullets.push(
          main === "volume"
            ? `Главная причина — ${lc(cm.label)}: ${a.fmt(countKey, c1)} против ${a.fmt(countKey, c0)} (${fmtSigned(dc ?? 0)}); средняя сумма на ${a.oneOf(cm)} при этом ${verbChange({ ...m, gender: "f" }, da ?? 0)}${da === null || Math.abs(da) < 1 ? "" : ` на ${fmtSigned(Math.abs(da)).replace("+", "")}`} (${a.fmt(m.key, avg1)}).`
            : `Главная причина — средняя сумма на ${a.oneOf(cm)}: ${a.fmt(m.key, avg1)} против ${a.fmt(m.key, avg0)} (${fmtSigned(da ?? 0)}); ${lc(cm.label)} ${verbChange(cm, dc ?? 0)}${dc === null || Math.abs(dc) < 1 ? "" : ` лишь на ${fmtSigned(Math.abs(dc)).replace("+", "")}`}.`
        );
      }
    }
    // The dimension that *explains* the change is the one whose top mover's
    // share of the change diverges most from its usual share of the metric: a
    // channel that gave 40% of revenue but 90% of the drop is the story; a
    // store that gives 90% of revenue and 90% of the drop merely mirrors it.
    const dims = a.dimensions.filter((d) => d.key !== "weekday" && d.key !== "month" && !q.filter.dims?.[d.key]);
    const total = cur - prev;
    let best: { dim: string; label: string; labelPlural: string; rows: { key: string; delta: number }[]; score: number } | null = null;
    for (const dim of dims) {
      const g1 = new Map(a.groups(m.key, dim.key, range, q.filter).map((g) => [g.key, g.value]));
      const g0 = new Map(a.groups(m.key, dim.key, prevRange, q.filter).map((g) => [g.key, g.value]));
      const keys = new Set([...g1.keys(), ...g0.keys()]);
      const rows = [...keys].map((k) => ({ key: k, delta: (g1.get(k) ?? 0) - (g0.get(k) ?? 0) })).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
      if (!rows.length || Math.abs(total) === 0) continue;
      const top = rows[0];
      const baseShare = prev > 0 ? (g0.get(top.key) ?? 0) / prev : 0;
      const changeShare = top.delta / total;
      const score = Math.abs(changeShare - baseShare) + (dim.key === a.config.primaryDimension ? 0.05 : 0);
      if (!best || score > best.score) best = { dim: dim.key, label: dim.label, labelPlural: dim.labelPlural, rows, score };
    }
    if (best && Math.abs(best.rows[0].delta) > 0 && Math.abs(total) > 0) {
      const top = best.rows[0];
      const share = Math.round((top.delta / total) * 100);
      const same = Math.sign(top.delta) === Math.sign(total);
      let s = `По ${lc(best.labelPlural)}: сильнее всего ${same ? "повлиял" : "в противоход шёл"} «${top.key}» — ${a.fmtDeltaValue(m, top.delta)}`;
      if (same && share > 0) s += ` (${Math.min(share, 999)}% всего изменения)`;
      const opposite = best.rows.find((r) => r.key !== top.key && Math.sign(r.delta) !== Math.sign(total) && Math.abs(r.delta) > Math.abs(total) * 0.1);
      if (opposite) s += `; «${opposite.key}», наоборот, ${a.fmtDeltaValue(m, opposite.delta)}`;
      bullets.push(s + ".");
    }
  }

  // 3. Drivers declared by the domain.
  if (m.drivers?.length) {
    const parts: string[] = [];
    for (const dk of m.drivers) {
      const dm = a.metric(dk);
      if (!dm || dk === m.key) continue;
      const v1 = a.value(dk, range, q.filter);
      const v0 = a.value(dk, prevRange, q.filter);
      if (v1 === null || v0 === null) continue;
      const dd = dm.unit === "percent" ? v1 - v0 : deltaPct(v1, v0);
      if (dd === null || Math.abs(dd) < 1) continue;
      parts.push(dm.unit === "percent" ? `${lc(dm.label)} ${v1 > v0 ? "выросла" : "снизилась"} с ${a.fmt(dk, v0)} до ${a.fmt(dk, v1)}` : `${lc(dm.label)} ${verbChange(dm, dd)} на ${fmtSigned(Math.abs(dd)).replace("+", "")} (${a.fmt(dk, v1)})`);
    }
    if (parts.length) bullets.push(`Связанные показатели: ${joinList(parts, ", ")}.`);
  }

  // 4. The most unusual day inside the period.
  const an = a.anomalies(m.key, range, q.filter)[0];
  if (an) {
    bullets.push(`Самый необычный день — ${fmtDayWithWeekday(an.date)}: ${a.fmt(m.key, an.value)} при обычных ${a.fmt(m.key, an.expected)} для этого дня недели (${an.zscore > 0 ? "+" : ""}${an.zscore}σ).`);
  }

  if (!bullets.length && d !== null && Math.abs(d) >= 1) bullets.push("Данных для разбора причин мало: нет разбивки по измерениям и связанных показателей за оба периода.");
  for (const b of bullets) lines.push(`${BULLET} ${b}`);

  if (d !== null && goodOrBad(m, d) === "bad") {
    const adv = adviceFor(a, m.key, opts, 1);
    if (adv.length) lines.push(adviceLine(adv));
  }
  return { text: lines.join("\n"), intent: "why", confidence: 0.9, followUps: followUpsFor(a, "why", m, q), metric: m.key, data: { current: cur, previous: prev } };
}

export function composeRank(a: Analyst, q: Query, m: MetricDef, opts: ComposeOptions): Answer {
  const dim = a.dimension(q.groupBy!)!;
  const range = opts.range;
  const groups = a.groups(m.key, dim.key, range, q.filter);
  const label = periodLabel(q, range, a.defaultRange(opts.today));
  if (!groups.length || groups.every((g) => g.value === 0)) {
    return { text: `Нет данных по показателю «${lc(m.label)}» по ${lc(dim.labelPlural)} ${label}`, intent: "rank", confidence: 0.8, followUps: followUpsFor(a, "rank", m, q), metric: m.key };
  }

  const prevGroups = new Map(a.groups(m.key, dim.key, previousRange(range), q.filter).map((g) => [g.key, g.value]));
  const withDelta = groups.map((g) => ({ ...g, delta: m.unit === "percent" ? (prevGroups.has(g.key) ? g.value - prevGroups.get(g.key)! : null) : deltaPct(g.value, prevGroups.get(g.key) ?? null) }));
  const ordered = q.direction === "bottom" ? [...withDelta].reverse() : withDelta;
  const shown = dim.key === "weekday" ? withDelta : ordered.slice(0, 5);

  const lines: string[] = [];
  const isRanking = dim.key !== "weekday";
  if (isRanking) {
    const head = ordered[0];
    lines.push(
      `${m.label} ${label}${filterSuffix(q)}: ${q.direction === "bottom" ? "меньше всего у" : "больше всего даёт"} ${lc(dim.label)} «${head.key}» — ${a.fmt(m.key, head.value)}${head.share !== undefined ? ` (${head.share}%)` : ""}.`
    );
  } else {
    lines.push(`${m.label} по дням недели ${label}${filterSuffix(q)}:`);
  }
  for (const g of shown) {
    const deltaTxt = g.delta === null ? "" : m.unit === "percent" ? ` (${fmtSigned(g.delta, " п.п.")})` : ` (${fmtSigned(g.delta)})`;
    lines.push(`${BULLET} ${g.key} — ${a.fmt(m.key, g.value)}${g.share !== undefined ? `, ${g.share}%` : ""}${deltaTxt}`);
  }
  const growing = withDelta.filter((g) => g.delta !== null && g.delta >= 5).sort((x, y) => y.delta! - x.delta!)[0];
  const falling = withDelta.filter((g) => g.delta !== null && g.delta <= -5).sort((x, y) => x.delta! - y.delta!)[0];
  const tail: string[] = [];
  if (growing) tail.push(`быстрее всех растёт «${growing.key}» (${fmtSigned(growing.delta!, m.unit === "percent" ? " п.п." : "%")})`);
  if (falling) tail.push(`падает «${falling.key}» (${fmtSigned(falling.delta!, m.unit === "percent" ? " п.п." : "%")})`);
  if (tail.length) lines.push(`К предыдущему периоду: ${joinList(tail, "; ")}.`);
  if (isRanking && groups[0].share !== undefined && groups[0].share >= 60 && groups.length > 1) {
    lines.push(`Обратите внимание: «${groups[0].key}» даёт ${groups[0].share}% — слишком многое зависит от одного значения.`);
  }
  return { text: lines.join("\n"), intent: "rank", confidence: 0.9, followUps: followUpsFor(a, "rank", m, q), metric: m.key, data: withDelta };
}

export function composeForecast(a: Analyst, q: Query, m: MetricDef, opts: ComposeOptions): Answer {
  const days = q.horizonDays ?? (q.range && q.range.from > opts.today ? daysInclusive(q.range.from, q.range.to) : 14);
  const fc = a.forecast(m.key, days, opts.today, q.filter);
  if (!fc.length) return { text: "Не хватает истории для прогноза.", intent: "forecast", confidence: 0.7, followUps: followUpsFor(a, "forecast", m, q), metric: m.key };
  const horizon = rangeStartingAt(addDays(opts.today, 1), days);
  const additive = m.kind !== "formula";
  const total = additive ? fc.reduce((s, p) => s + p.value, 0) : mean(fc.map((p) => p.value));
  const low = additive ? fc.reduce((s, p) => s + p.low, 0) : mean(fc.map((p) => p.low));
  const high = additive ? fc.reduce((s, p) => s + p.high, 0) : mean(fc.map((p) => p.high));
  const floor = additive ? fc.reduce((s, p) => s + p.floor, 0) : mean(fc.map((p) => p.floor));
  const lastRange = { from: addDays(opts.today, -(days - 1)), to: opts.today };
  const last = a.value(m.key, lastRange, q.filter);
  const lines: string[] = [];
  lines.push(
    `Прогноз: ${lc(m.label)} ${q.rangeLabel ?? `на ${daysWord(days)}`} (${fmtRange(horizon)})${filterSuffix(q)} — ${additive ? "" : "в среднем "}${a.fmt(m.key, total)}, коридор ${a.fmt(m.key, low)}–${a.fmt(m.key, high)}.` +
      (additive && floor > 0 ? ` Уже подтверждено ${a.fmt(m.key, floor)} (${Math.round((floor / Math.max(total, 1)) * 100)}%).` : "")
  );
  if (last !== null && last > 0) {
    const d = m.unit === "percent" ? total - last : deltaPct(total, last);
    if (d !== null) lines.push(m.unit === "percent" ? `За предыдущие ${daysWord(days)} было ${a.fmt(m.key, last)} — ожидается на ${Math.abs(Math.round(d))} п.п. ${d >= 0 ? "выше" : "ниже"}.` : `За предыдущие ${daysWord(days)} было ${a.fmt(m.key, last)} — ожидается ${fmtSigned(d)}.`);
  }
  const sorted = [...fc].sort((x, y) => x.value - y.value);
  const weak = sorted.slice(0, Math.min(3, fc.length)).filter((p) => p.value < mean(fc.map((x) => x.value)) * 0.7);
  const strong = sorted.slice(-2).filter((p) => p.value > mean(fc.map((x) => x.value)) * 1.3);
  if (weak.length) lines.push(`Самые слабые дни: ${weak.map((p) => `${fmtDayWithWeekday(p.date)} (${a.fmt(m.key, p.value)})`).join(", ")}.`);
  if (strong.length) lines.push(`Самые сильные: ${strong.reverse().map((p) => `${fmtDayWithWeekday(p.date)} (${a.fmt(m.key, p.value)})`).join(", ")}.`);
  lines.push("Как считаю: среднее по дню недели за 12 недель с поправкой на темп последнего месяца; не ниже уже подтверждённого.");
  if (q.wantsAdvice) {
    const adv = adviceFor(a, m.key, opts, 2);
    if (adv.length) lines.push(adviceLine(adv));
  }
  return { text: lines.join("\n"), intent: "forecast", confidence: 0.9, followUps: followUpsFor(a, "forecast", m, q), metric: m.key, data: fc };
}

export function composeDays(a: Analyst, q: Query, m: MetricDef, opts: ComposeOptions, which: "weakDays" | "strongDays"): Answer {
  // Future-looking by default ("какие дни впереди слабые"); past when a past range was named.
  const pastRange = q.range && q.range.to <= opts.today ? q.range : null;
  const lines: string[] = [];
  let points: { date: string; value: number }[];
  let scopeLabel: string;
  if (pastRange) {
    points = a.series(m.key, pastRange, q.filter);
    scopeLabel = q.rangeLabel ?? `за ${fmtRange(pastRange)}`;
  } else {
    const days = q.horizonDays ?? 14;
    points = a.forecast(m.key, days, opts.today, q.filter).map((p) => ({ date: p.date, value: p.value }));
    scopeLabel = `в ближайшие ${daysWord(days)}`;
  }
  if (!points.length) return { text: "Нет данных за этот период.", intent: which, confidence: 0.7, followUps: followUpsFor(a, which, m, q), metric: m.key };
  const avg = mean(points.map((p) => p.value));
  const sorted = [...points].sort((x, y) => (which === "weakDays" ? x.value - y.value : y.value - x.value));
  const pick = sorted.slice(0, Math.min(4, points.length));
  lines.push(`${which === "weakDays" ? "Самые слабые" : "Самые сильные"} дни ${scopeLabel}${filterSuffix(q)} по показателю «${lc(m.label)}» (среднее ${a.fmt(m.key, avg)}):`);
  for (const p of pick) lines.push(`${BULLET} ${fmtDayWithWeekday(p.date)} — ${a.fmt(m.key, p.value)}`);
  // Weekday pattern behind it.
  const wd = a.weekdayProfile(m.key, opts.today, q.filter);
  const nonEmpty = wd.filter((w) => w.value > 0);
  if (nonEmpty.length >= 3) {
    const worst = [...nonEmpty].sort((x, y) => x.value - y.value)[0];
    const best = [...nonEmpty].sort((x, y) => y.value - x.value)[0];
    // Only worth saying when the week actually has a shape.
    if (best.weekday !== worst.weekday && best.value - worst.value >= Math.max(best.value * 0.15, 1)) {
      lines.push(`Закономерность за 12 недель: слабее всего ${WEEKDAY_FULL[worst.weekday]} (${a.fmt(m.key, worst.value)}), сильнее всего ${WEEKDAY_FULL[best.weekday]} (${a.fmt(m.key, best.value)}).`);
    }
  }
  if (which === "weakDays" || q.wantsAdvice) {
    const adv = adviceFor(a, m.key, opts, which === "weakDays" ? 2 : 1);
    if (adv.length) lines.push(adviceLine(adv));
  }
  return { text: lines.join("\n"), intent: which, confidence: 0.9, followUps: followUpsFor(a, which, m, q), metric: m.key, data: pick };
}

export function composeTrend(a: Analyst, q: Query, m: MetricDef, opts: ComposeOptions): Answer {
  const range = opts.range;
  const series = a.series(m.key, range, q.filter);
  if (series.length < 3) return { text: "Слишком короткий период для оценки динамики.", intent: "trend", confidence: 0.7, followUps: followUpsFor(a, "trend", m, q), metric: m.key };
  const t = linearTrend(series);
  const label = periodLabel(q, range, a.defaultRange(opts.today));
  const g = genderOf(m);
  const dirWord = t.direction === "up" ? agree(g, ["растёт", "растёт", "растёт"]) : t.direction === "down" ? "снижается" : agree(g, ["стабилен", "стабильна", "стабильно"]);
  const conf = t.r2 >= 0.5 ? "тренд уверенный" : t.r2 >= 0.2 ? "тренд заметный, но с колебаниями" : "колебания сильнее тренда";
  const lines: string[] = [];
  lines.push(`${m.label} ${label}${filterSuffix(q)} ${dirWord}${t.direction === "flat" ? "" : `: примерно ${fmtSigned(t.weeklyPct)} в неделю`} (${conf}).`);
  if (series.length >= 14) {
    const last7 = series.slice(-7).map((p) => p.value);
    const prev7 = series.slice(-14, -7).map((p) => p.value);
    const l = m.kind === "formula" ? mean(last7) : last7.reduce((s, x) => s + x, 0);
    const p = m.kind === "formula" ? mean(prev7) : prev7.reduce((s, x) => s + x, 0);
    const d = m.unit === "percent" ? l - p : deltaPct(l, p);
    if (d !== null) lines.push(`Последняя неделя — ${a.fmt(m.key, l)} против ${a.fmt(m.key, p)} неделей ранее (${m.unit === "percent" ? fmtSigned(d, " п.п.") : fmtSigned(d)}).`);
  }
  const max = series.reduce((b, p) => (p.value > b.value ? p : b), series[0]);
  const min = series.reduce((b, p) => (p.value < b.value ? p : b), series[0]);
  lines.push(`Пик — ${fmtDayWithWeekday(max.date)} (${a.fmt(m.key, max.value)}), минимум — ${fmtDayWithWeekday(min.date)} (${a.fmt(m.key, min.value)}).`);
  if (t.direction === "down" && (m.higherIsBetter ?? true)) {
    const adv = adviceFor(a, m.key, opts, 1);
    if (adv.length) lines.push(adviceLine(adv));
  }
  return { text: lines.join("\n"), intent: "trend", confidence: 0.88, followUps: followUpsFor(a, "trend", m, q), metric: m.key, data: t };
}

export function composeAnomaly(a: Analyst, q: Query, m: MetricDef, opts: ComposeOptions): Answer {
  const range = opts.range;
  const list = a.anomalies(m.key, range, q.filter);
  const label = periodLabel(q, range, a.defaultRange(opts.today));
  if (!list.length) return { text: `${label[0].toUpperCase()}${label.slice(1)} необычных дней по показателю «${lc(m.label)}» не нашёл: всё в пределах обычных колебаний для каждого дня недели.`, intent: "anomaly", confidence: 0.85, followUps: followUpsFor(a, "anomaly", m, q), metric: m.key };
  const lines = [`${label[0].toUpperCase()}${label.slice(1)} нашёл ${list.length} ${list.length === 1 ? "необычный день" : list.length < 5 ? "необычных дня" : "необычных дней"} по показателю «${lc(m.label)}»:`];
  for (const an of list.slice(0, 5)) {
    lines.push(`${BULLET} ${fmtDayWithWeekday(an.date)} — ${a.fmt(m.key, an.value)} при обычных ${a.fmt(m.key, an.expected)} для этого дня недели (${an.zscore > 0 ? "+" : ""}${an.zscore}σ)`);
  }
  lines.push("Порог — 2σ от среднего того же дня недели за 12 недель.");
  return { text: lines.join("\n"), intent: "anomaly", confidence: 0.88, followUps: followUpsFor(a, "anomaly", m, q), metric: m.key, data: list };
}

export function composeRecommend(a: Analyst, q: Query, m: MetricDef | undefined, opts: ComposeOptions): Answer {
  const lines: string[] = [];
  const target = m ?? a.defaultMetric();
  const adv = adviceFor(a, target.key, opts, 4);
  const cur = a.value(target.key, opts.range, q.filter);
  const prev = a.value(target.key, previousRange(opts.range), q.filter);
  const head = cur === null ? `${target.label}: данных за период нет.` : `${target.label} сейчас ${a.fmt(target.key, cur)}${compareClause(a, target, cur, prev)}.`;
  lines.push(head);
  if (adv.length) {
    lines.push(`Чтобы улучшить ${lc(accusative(target))}${filterSuffix(q)}, начните с:`);
    for (const s of adv) lines.push(`${BULLET} ${s}`);
  } else {
    lines.push("Конкретных сигналов для действий по этому показателю сейчас нет — период выглядит ровно. Держите цены и следите за прогнозом на ближайшие дни.");
  }
  return { text: lines.join("\n"), intent: "recommend", confidence: 0.85, followUps: followUpsFor(a, "recommend", target, q), metric: target.key };
}

export function composeCompareMetrics(a: Analyst, q: Query, metrics: MetricDef[], opts: ComposeOptions): Answer {
  const range = opts.range;
  const prevRange = previousRange(range);
  const label = periodLabel(q, range, a.defaultRange(opts.today));
  const rows = metrics.map((m) => {
    const cur = a.value(m.key, range, q.filter);
    const prev = a.value(m.key, prevRange, q.filter);
    const d = cur === null || prev === null ? null : m.unit === "percent" ? cur - prev : deltaPct(cur, prev);
    return { m, cur, prev, d };
  });
  const lines = [`${label[0].toUpperCase()}${label.slice(1)}${filterSuffix(q)}:`];
  for (const r of rows) {
    const deltaTxt = r.d === null ? "" : r.m.unit === "percent" ? ` (${fmtSigned(r.d, " п.п.")})` : ` (${fmtSigned(r.d)})`;
    lines.push(`${BULLET} ${r.m.label} — ${a.fmt(r.m.key, r.cur)}${deltaTxt}`);
  }
  // The one moving the wrong way the most.
  const bad = rows
    .filter((r) => r.d !== null && goodOrBad(r.m, r.d) === "bad")
    .sort((x, y) => Math.abs(y.d!) - Math.abs(x.d!))[0];
  const moneyRows = rows.filter((r) => r.m.unit === "money" && r.cur !== null && !(r.m.higherIsBetter ?? true));
  const biggest = moneyRows.sort((x, y) => (y.cur ?? 0) - (x.cur ?? 0))[0];
  if (biggest && biggest.cur! > 0) lines.push(`Больше всего денег уходит через ${lc(biggest.m.label)}: ${a.fmt(biggest.m.key, biggest.cur)}.`);
  if (bad) lines.push(`Хуже всего динамика у показателя «${lc(bad.m.label)}»: ${bad.m.unit === "percent" ? fmtSigned(bad.d!, " п.п.") : fmtSigned(bad.d!)} к предыдущему периоду.`);
  const adv = adviceFor(a, (bad ?? biggest)?.m.key, opts, 1);
  if (adv.length) lines.push(adviceLine(adv));
  return { text: lines.join("\n"), intent: "compareMetrics", confidence: 0.88, followUps: followUpsFor(a, "compareMetrics", (bad ?? biggest)?.m, q) };
}

export function composeSummary(a: Analyst, q: Query, opts: ComposeOptions): Answer {
  return { text: a.narrative({ range: opts.range, today: opts.today, insights: opts.insights, rangeLabel: q.rangeLabel }), intent: "summary", confidence: 0.9, followUps: followUpsFor(a, "summary", undefined, q) };
}

export function composeHelp(a: Analyst, q: Query, unknown: boolean): Answer {
  const metricNames = a.metrics.slice(0, 6).map((m) => lc(m.label));
  const dims = a.dimensions.filter((d) => d.key !== "weekday" && d.key !== "month").map((d) => lc(d.labelPlural));
  const lines = [
    unknown ? "Не понял вопрос. Вот что я умею:" : "Я отвечаю на вопросы по вашим данным без внешних сервисов. Умею:",
    `${BULLET} значения показателей за период: ${joinList(metricNames)} — например «сколько было выручки за прошлый месяц»`,
    `${BULLET} причины изменений: «почему упала загрузка в сентябре»`,
    dims.length ? `${BULLET} разбивки и рейтинги по ${joinList(dims)}: «какой канал приносит больше всего»` : "",
    `${BULLET} прогноз и слабые/сильные дни впереди: «какие дни в ближайшие 2 недели самые слабые»`,
    `${BULLET} динамику, аномалии и сводку: «динамика ADR за 30 дней», «были ли необычные дни», «как дела»`,
    `${BULLET} советы: «что сделать, чтобы поднять загрузку в выходные»`,
    "Понимаю периоды: сегодня, вчера, за неделю, за 2 недели, этот/прошлый месяц, в сентябре, с 1 по 10 сентября, в выходные, в будни.",
  ].filter(Boolean);
  return { text: lines.join("\n"), intent: unknown ? "unknown" : "help", confidence: unknown ? 0.25 : 0.9, followUps: followUpsFor(a, "help", undefined, q) };
}

export function composeAnswer(a: Analyst, q: Query, opts: ComposeOptions): Answer {
  const m = q.metrics[0] ? a.metric(q.metrics[0]) : undefined;
  const fallbackMetric = m ?? a.defaultMetric();
  const withDefaultPenalty = (ans: Answer): Answer => (m ? ans : { ...ans, confidence: Math.min(ans.confidence, 0.72) });
  switch (q.intent) {
    case "help":
      return composeHelp(a, q, false);
    case "unknown":
      return composeHelp(a, q, true);
    case "summary":
      return composeSummary(a, q, opts);
    case "compareMetrics":
      return composeCompareMetrics(a, q, q.metrics.map((k) => a.metric(k)!).filter(Boolean), opts);
    case "recommend":
      return composeRecommend(a, q, m, opts);
    case "why":
      return withDefaultPenalty(composeWhy(a, q, fallbackMetric, opts));
    case "rank":
      return withDefaultPenalty(composeRank(a, q, fallbackMetric, opts));
    case "forecast":
      return withDefaultPenalty(composeForecast(a, q, fallbackMetric, opts));
    case "weakDays":
    case "strongDays":
      return withDefaultPenalty(composeDays(a, q, m ?? a.daysMetric(), opts, q.intent));
    case "trend":
      return withDefaultPenalty(composeTrend(a, q, fallbackMetric, opts));
    case "anomaly":
      return withDefaultPenalty(composeAnomaly(a, q, fallbackMetric, opts));
    case "value":
    default:
      return withDefaultPenalty(composeValue(a, q, fallbackMetric, opts));
  }
}

export type { Advice, Filter };
