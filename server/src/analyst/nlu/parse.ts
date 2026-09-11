import { DateRange, DimensionDef, Filter, Intent, MetricDef } from "../core/types";
import { addDays, endOfMonth, rangeEndingAt, rangeStartingAt, startOfMonth, startOfWeek, toIso, isIsoDate, clampRangeTo } from "../core/dates";
import { MONTHS_PREP } from "../core/format";
import { findPhrase, stem, stemPhrase, tokenize } from "./stem";
import { DIRECTION_PHRASES, GROUP_PREFIXES, INTENT_PHRASES, MONTH_WORDS, NUMBER_WORDS, TIME_PHRASES, UNIT_DAYS, UNIT_WORDS } from "./lexicon";

/*
 * Turns a Russian question into a structured Query. Purely lexical: stems of
 * known phrases, metric and dimension synonyms, dimension *values* seen in
 * the data ("в Telegram" → filter source = Telegram), and a calendar parser
 * for "за прошлый месяц", "в сентябре", "с 1 по 10 сентября", "за 2 недели",
 * "на неделю вперёд", "в выходные".
 */

export interface Query {
  intent: Intent;
  /** Every intent that fired, strongest first — lets one answer add a second aspect. */
  intents: Intent[];
  metrics: string[];
  range?: DateRange;
  rangeLabel?: string;
  compare: boolean;
  groupBy?: string;
  filter: Filter;
  filterLabels: string[];
  direction?: "top" | "bottom";
  horizonDays?: number;
  wantsAdvice: boolean;
  raw: string;
}

export interface ParseContext {
  metrics: MetricDef[];
  dimensions: DimensionDef[];
  dimensionValues: (dim: string) => string[];
  today: string;
}

type Stemmed = { phrase: string; stems: string[] };
const cache = new Map<string, Stemmed[]>();
function stemmed(key: string, phrases: readonly string[]): Stemmed[] {
  let list = cache.get(key);
  if (!list) {
    list = phrases.map((phrase) => ({ phrase, stems: stemPhrase(phrase) })).sort((a, b) => b.stems.length - a.stems.length);
    cache.set(key, list);
  }
  return list;
}

function firstHit(stems: string[], key: string, phrases: readonly string[]): number {
  let best = -1;
  for (const p of stemmed(key, phrases)) {
    const i = findPhrase(stems, p.stems);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best;
}

function parseNumberToken(tok: string): number | null {
  if (/^\d+$/.test(tok)) return Number(tok);
  return NUMBER_WORDS[tok] ?? null;
}

function unitAt(stems: string[], tokens: string[], i: number): keyof typeof UNIT_WORDS | null {
  for (const [unit, words] of Object.entries(UNIT_WORDS) as [keyof typeof UNIT_WORDS, string[]][]) {
    if (words.some((w) => tokens[i] === w || stem(w) === stems[i])) return unit;
  }
  return null;
}

interface TimeResult {
  range?: DateRange;
  label?: string;
  weekdays?: number[];
  weekdayLabel?: string;
  horizonDays?: number;
  future: boolean;
}

function parseTime(tokens: string[], stems: string[], today: string, hasForecast: boolean): TimeResult {
  const res: TimeResult = { future: false };
  const has = (key: keyof typeof TIME_PHRASES) => firstHit(stems, `t:${key}`, TIME_PHRASES[key]) >= 0;

  if (has("weekend")) {
    res.weekdays = [5, 6];
    res.weekdayLabel = "в выходные (ночи пт–сб)";
  } else if (has("workdays")) {
    res.weekdays = [0, 1, 2, 3, 4];
    res.weekdayLabel = "в будни";
  }

  // Explicit dates: 10.09.2026, 10.09, 2026-09-10 — one date or a pair.
  const dates: string[] = [];
  for (const t of tokens) {
    let m = t.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
    if (m) {
      const y = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
      const iso = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      if (isIsoDate(iso)) dates.push(iso);
      continue;
    }
    if (isIsoDate(t)) dates.push(t);
  }
  if (dates.length >= 2) {
    const [a, b] = dates.slice(0, 2).sort();
    return { ...res, range: { from: a, to: b }, label: undefined };
  }
  if (dates.length === 1) return { ...res, range: { from: dates[0], to: dates[0] } };

  if (has("today")) return { ...res, range: { from: today, to: today }, label: "сегодня" };
  if (has("yesterday")) {
    const d = addDays(today, -1);
    return { ...res, range: { from: d, to: d }, label: "вчера" };
  }
  if (has("dayBeforeYesterday")) {
    const d = addDays(today, -2);
    return { ...res, range: { from: d, to: d }, label: "позавчера" };
  }

  // Month names, with optional day numbers / year around them.
  for (let mi = 0; mi < 12; mi++) {
    const idx = tokens.findIndex((t) => MONTH_WORDS[mi].includes(t));
    if (idx < 0) continue;
    let year = Number(today.slice(0, 4));
    const after = tokens[idx + 1];
    if (after && /^\d{4}$/.test(after)) year = Number(after);
    const before1 = tokens[idx - 1];
    const before2 = tokens[idx - 2];
    const before3 = tokens[idx - 3];
    const d1 = before1 ? parseNumberToken(before1) : null;
    const mm = String(mi + 1).padStart(2, "0");
    const day = (n: number) => `${year}-${mm}-${String(n).padStart(2, "0")}`;
    // "с 1 по 10 сентября" / "1-10 сентября"
    if (d1 !== null && d1 <= 31 && before2 === "по" && before3 && parseNumberToken(before3) !== null) {
      const a = parseNumberToken(before3)!;
      return { ...res, range: { from: day(Math.min(a, d1)), to: day(Math.max(a, d1)) }, label: `${Math.min(a, d1)}–${Math.max(a, d1)} ${MONTH_WORDS[mi][1]}` };
    }
    if (d1 !== null && d1 <= 31 && before2 && /^\d{1,2}$/.test(before2) && !before3?.match(/^(с|по)$/)) {
      // tokens like "5 7 сентября" are unlikely; fall through to single day
    }
    if (d1 !== null && d1 >= 1 && d1 <= 31) {
      const iso = day(d1);
      return { ...res, range: { from: iso, to: iso }, label: `${d1} ${MONTH_WORDS[mi][1]}` };
    }
    const from = `${year}-${mm}-01`;
    const to = endOfMonth(from);
    const isFuture = from > today;
    const range = isFuture ? { from, to } : clampRangeTo({ from, to }, today);
    return { ...res, range, label: `в ${MONTHS_PREP[mi]}${year !== Number(today.slice(0, 4)) ? ` ${year}` : ""}`, future: isFuture };
  }

  // "прошлый/этот <unit>", "за N <unit>", "последние N <unit>", "на N <unit> вперёд".
  for (let i = 0; i < tokens.length; i++) {
    const unit = unitAt(stems, tokens, i);
    if (!unit) continue;
    const prevWords = stemmed("t:prev", TIME_PHRASES.prev);
    const curWords = stemmed("t:current", TIME_PHRASES.current);
    const isPrev = i > 0 && prevWords.some((p) => findPhrase([stems[i - 1]], p.stems) === 0);
    const isCur = i > 0 && curWords.some((p) => findPhrase([stems[i - 1]], p.stems) === 0);
    if (isPrev && unit !== "day") {
      if (unit === "week") {
        const thisMon = startOfWeek(today);
        return { ...res, range: { from: addDays(thisMon, -7), to: addDays(thisMon, -1) }, label: "за прошлую неделю" };
      }
      if (unit === "month") {
        const prevEnd = addDays(startOfMonth(today), -1);
        return { ...res, range: { from: startOfMonth(prevEnd), to: prevEnd }, label: "за прошлый месяц" };
      }
      if (unit === "quarter") return { ...res, range: rangeEndingAt(addDays(today, -1), 90), label: "за прошлый квартал" };
      const y = Number(today.slice(0, 4)) - 1;
      return { ...res, range: { from: `${y}-01-01`, to: `${y}-12-31` }, label: `за ${y} год` };
    }
    if (isCur && unit !== "day") {
      if (unit === "week") return { ...res, range: { from: startOfWeek(today), to: today }, label: "за эту неделю" };
      if (unit === "month") return { ...res, range: { from: startOfMonth(today), to: today }, label: "за этот месяц" };
      if (unit === "quarter") return { ...res, range: rangeEndingAt(today, 90), label: "за квартал" };
      return { ...res, range: { from: `${today.slice(0, 4)}-01-01`, to: today }, label: "за этот год" };
    }
    // A number one or two tokens back: "2 недели", "последние 7 дней".
    let n: number | null = null;
    for (let back = 1; back <= 2 && i - back >= 0; back++) {
      const v = parseNumberToken(tokens[i - back]);
      if (v !== null) {
        n = v;
        break;
      }
    }
    const count = n ?? 1;
    const days = count * UNIT_DAYS[unit];
    const lead = tokens[i - 1] === "на" || tokens[i - 2] === "на";
    const ahead = firstHit(stems, "t:ahead", TIME_PHRASES.ahead) >= 0 || firstHit(stems, "t:tomorrow", TIME_PHRASES.tomorrow) >= 0;
    if ((lead && hasForecast) || ahead) {
      return { ...res, horizonDays: Math.max(1, Math.min(days, 90)), future: true, label: `на ${count === 1 ? "" : `${count} `}${unitLabel(unit, count)}` };
    }
    return { ...res, range: rangeEndingAt(today, days), label: `за ${count === 1 ? "" : `${count} `}${unitLabel(unit, count)}` };
  }

  if (has("tomorrow")) return { ...res, horizonDays: 1, future: true, label: "на завтра" };
  if (hasForecast && firstHit(stems, "t:ahead", TIME_PHRASES.ahead) >= 0) return { ...res, horizonDays: 14, future: true, label: "на 14 дней" };
  return res;
}

function unitLabel(unit: keyof typeof UNIT_WORDS, n: number): string {
  const forms: Record<keyof typeof UNIT_WORDS, [string, string, string]> = {
    day: ["день", "дня", "дней"],
    week: ["неделю", "недели", "недель"],
    month: ["месяц", "месяца", "месяцев"],
    quarter: ["квартал", "квартала", "кварталов"],
    year: ["год", "года", "лет"],
  };
  const a = Math.abs(n) % 100;
  const b = a % 10;
  const f = forms[unit];
  if (a > 10 && a < 20) return f[2];
  if (b > 1 && b < 5) return f[1];
  if (b === 1) return f[0];
  return f[2];
}

export function parseQuestion(text: string, ctx: ParseContext): Query {
  const raw = text.trim();
  const tokens = tokenize(raw);
  const stems = tokens.map(stem);

  // ---- metrics (ordered by first mention)
  const metricHits: { key: string; at: number }[] = [];
  for (const m of ctx.metrics) {
    const at = firstHit(stems, `m:${m.key}`, [...m.synonyms, m.label]);
    if (at >= 0) metricHits.push({ key: m.key, at });
  }
  metricHits.sort((a, b) => a.at - b.at);
  const metrics = metricHits.map((h) => h.key);

  // ---- dimensions: grouping ("по каналам") and value filters ("в Telegram")
  let groupBy: string | undefined;
  const filter: Filter = {};
  const filterLabels: string[] = [];
  for (const d of ctx.dimensions) {
    for (const syn of [...d.synonyms, d.label, d.labelPlural]) {
      const ps = stemPhrase(syn);
      const at = findPhrase(stems, ps);
      if (at < 0) continue;
      const prefixed = GROUP_PREFIXES.some((p) => {
        const pp = stemPhrase(p);
        return at - pp.length >= 0 && findPhrase(stems.slice(at - pp.length, at), pp) === 0;
      });
      const rankWord = firstHit(stems, "rank", INTENT_PHRASES.rank);
      if (prefixed || (rankWord >= 0 && rankWord < at)) {
        if (!groupBy) groupBy = d.key;
      } else if (!groupBy) groupBy = d.key; // "выручка каналов" — a bare mention still means "per channel"
      break;
    }
    if (d.key === "weekday" || d.key === "month") continue;
    const values = ctx.dimensionValues(d.key);
    for (const v of values) {
      const vs = stemPhrase(v);
      if (!vs.length || vs.join("").length < 3) continue;
      if (findPhrase(stems, vs) >= 0) {
        const cur = filter.dims?.[d.key];
        filter.dims = { ...(filter.dims ?? {}), [d.key]: cur ? [...(Array.isArray(cur) ? cur : [cur]), v] : v };
        filterLabels.push(`${d.label.toLowerCase()} «${v}»`);
      }
    }
  }
  // A dimension named only as a filter value is not a grouping.
  if (groupBy && filter.dims?.[groupBy]) groupBy = undefined;

  // ---- intents
  const hits: { intent: Intent; at: number }[] = [];
  const check = (intent: Intent, key: keyof typeof INTENT_PHRASES) => {
    const at = firstHit(stems, `i:${key}`, INTENT_PHRASES[key]);
    if (at >= 0) hits.push({ intent, at });
  };
  check("recommend", "recommend");
  check("why", "why");
  check("forecast", "forecast");
  check("weakDays", "weakDays");
  check("strongDays", "strongDays");
  check("anomaly", "anomaly");
  check("rank", "rank");
  check("trend", "trend");
  check("summary", "summary");
  check("help", "help");
  check("value", "value");
  const hasCompare = firstHit(stems, "i:compare", INTENT_PHRASES.compare) >= 0;
  const hasLose = firstHit(stems, "i:lose", INTENT_PHRASES.lose) >= 0;

  const wantsAdvice = hits.some((h) => h.intent === "recommend");
  const priority: Intent[] = ["help", "summary", "weakDays", "strongDays", "why", "recommend", "forecast", "anomaly", "rank", "trend", "value"];
  const fired = new Set(hits.map((h) => h.intent));

  let intent: Intent = "unknown";
  // "какой канал лучший" is a ranking only when there is something to rank by.
  const rankable = fired.has("rank") && (groupBy || metrics.length === 0);
  for (const p of priority) {
    if (!fired.has(p)) continue;
    if (p === "rank" && !rankable) continue;
    // A bare "какой/сколько" with a metric is a value question, not a ranking.
    intent = p;
    break;
  }
  if (metrics.length >= 2 && !groupBy && (intent === "value" || intent === "unknown" || hasLose || (intent === "rank" && !groupBy))) intent = "compareMetrics";
  if (intent === "rank" && !groupBy) intent = metrics.length ? "value" : "unknown";
  if (intent === "unknown" && metrics.length) intent = groupBy ? "rank" : "value";
  if (intent === "value" && groupBy) intent = "rank";
  if (intent === "trend" && groupBy) intent = "rank";
  if (intent === "summary" && metrics.length && !fired.has("summary")) intent = "value";

  // ---- direction
  let direction: Query["direction"];
  const top = firstHit(stems, "d:top", DIRECTION_PHRASES.top);
  const bottom = firstHit(stems, "d:bottom", DIRECTION_PHRASES.bottom);
  if (bottom >= 0 && (top < 0 || bottom < top)) direction = "bottom";
  else if (top >= 0) direction = "top";

  // ---- time
  const time = parseTime(tokens, stems, ctx.today, intent === "forecast" || intent === "weakDays" || intent === "strongDays");
  if (time.weekdays) {
    filter.weekdays = time.weekdays;
    if (time.weekdayLabel) filterLabels.push(time.weekdayLabel);
  }
  if (time.future && intent === "value") intent = "forecast";
  if (time.range && time.future && intent !== "forecast") intent = "forecast";

  const intents = [intent, ...priority.filter((p) => p !== intent && fired.has(p))];
  return {
    intent,
    intents,
    metrics,
    range: time.range,
    rangeLabel: time.label,
    compare: hasCompare || intent === "why" || fired.has("trend"),
    groupBy,
    filter,
    filterLabels,
    direction,
    horizonDays: time.horizonDays,
    wantsAdvice,
    raw,
  };
}

/** For tests and debugging: today as ISO in local time. */
export const todayIso = (): string => toIso(new Date());
export { rangeStartingAt };
