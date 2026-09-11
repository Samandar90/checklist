import { DateRange, Gender, MetricDef } from "./types";
import { parseIso } from "./dates";

/* Russian number, money, date and grammar helpers used by every answer. */

const RU = "ru-RU";

export const WEEKDAY_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
export const WEEKDAY_FULL = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
export const MONTHS_NOM = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
export const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export const MONTHS_PREP = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];

/** plural(3, ["ночь", "ночи", "ночей"]) → "ночи" */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(Math.round(n)) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export function fmtNumber(n: number, decimals = 0): string {
  return n.toLocaleString(RU, { maximumFractionDigits: decimals });
}

/** 3 850 000 → "3,9 млн", 850 000 → "850 тыс", 640 → "640". */
export function fmtMoney(n: number, currency?: string): string {
  const abs = Math.abs(n);
  let s: string;
  if (abs >= 1_000_000) s = `${(n / 1_000_000).toLocaleString(RU, { maximumFractionDigits: abs >= 10_000_000 ? 0 : 1 })} млн`;
  else if (abs >= 1000) s = `${Math.round(n / 1000).toLocaleString(RU)} тыс`;
  else s = Math.round(n).toLocaleString(RU);
  return currency ? `${s} ${currency}` : s;
}

export function fmtPercent(n: number, decimals = 0): string {
  return `${n.toLocaleString(RU, { maximumFractionDigits: decimals })}%`;
}

/** +12 → "+12%", −8.4 → "−8%" (typographic minus). */
export function fmtSigned(n: number, unit = "%", decimals = 0): string {
  const s = Math.abs(n).toLocaleString(RU, { maximumFractionDigits: decimals });
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${s}${unit}`;
}

export function fmtDate(iso: string): string {
  return parseIso(iso).toLocaleDateString(RU, { day: "numeric", month: "short" });
}

/** "сб 5 сент." */
export function fmtDayWithWeekday(iso: string): string {
  return `${WEEKDAY_SHORT[parseIso(iso).getDay()]} ${fmtDate(iso)}`;
}

export function fmtRange(r: DateRange): string {
  return r.from === r.to ? fmtDate(r.from) : `${fmtDate(r.from)} – ${fmtDate(r.to)}`;
}

export function fmtMetric(metric: MetricDef, value: number | null, currency?: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  switch (metric.unit) {
    case "money":
      return fmtMoney(value, currency);
    case "percent":
      return fmtPercent(value, metric.decimals ?? 0);
    case "count":
      return metric.nounForms ? `${fmtNumber(value)} ${plural(value, metric.nounForms)}` : fmtNumber(value);
    default:
      return fmtNumber(value, metric.decimals ?? 0);
  }
}

/** Gender of a label from its ending: выручка → f, число → n, тариф → m. */
export function genderOf(metric: MetricDef): Gender {
  if (metric.gender) return metric.gender;
  const w = metric.label.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  // Latin labels (ADR, RevPAR) read as masculine nouns.
  if (!/[а-яё]$/.test(w)) return "m";
  if (/[ая]$/.test(w)) return "f";
  if (/[ое]$/.test(w)) return "n";
  return "m";
}

/** agree("f", ["вырос", "выросла", "выросло"]) → "выросла" */
export function agree(g: Gender, forms: [string, string, string]): string {
  return g === "m" ? forms[0] : g === "f" ? forms[1] : forms[2];
}

/** Lower-case the first letter for use mid-sentence — but leave acronyms (ADR, RevPAR) alone. */
export function lc(s: string): string {
  if (!s.length) return s;
  const first = s.split(/\s+/)[0];
  if (/[A-ZА-ЯЁ]/.test(first.slice(1))) return s;
  return s[0].toLowerCase() + s.slice(1);
}

/** Accusative of a label: "Загрузка" → "Загрузку", "Число броней" unchanged. */
export function accusative(metric: MetricDef): string {
  if (metric.labelAcc) return metric.labelAcc;
  if (genderOf(metric) !== "f") return metric.label;
  const [first, ...rest] = metric.label.split(" ");
  return [first.replace(/а$/, "у").replace(/я$/, "ю"), ...rest].join(" ");
}

/** "14 дней", "21 день", "3 дня". */
export function daysWord(n: number): string {
  return `${n} ${plural(n, ["день", "дня", "дней"])}`;
}

export function joinList(items: string[], last = " и "): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")}${last}${items[items.length - 1]}`;
}
