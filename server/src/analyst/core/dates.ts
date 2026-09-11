import { DateRange } from "./types";

/* Calendar helpers on ISO day strings (YYYY-MM-DD), local time, no libraries. */

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseIso(s).getTime());
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function daysInclusive(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / DAY_MS) + 1;
}

export function listDays(from: string, to: string): string[] {
  const n = daysInclusive(from, to);
  if (n <= 0) return [];
  const out: string[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = addDays(from, i);
  return out;
}

export function weekdayOf(iso: string): number {
  return parseIso(iso).getDay();
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: string): string {
  const d = parseIso(iso);
  return toIso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const wd = weekdayOf(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

/** The period of equal length immediately before `r`. */
export function previousRange(r: DateRange): DateRange {
  const n = daysInclusive(r.from, r.to);
  const to = addDays(r.from, -1);
  return { from: addDays(to, -(n - 1)), to };
}

export function rangeEndingAt(to: string, days: number): DateRange {
  return { from: addDays(to, -(days - 1)), to };
}

export function rangeStartingAt(from: string, days: number): DateRange {
  return { from, to: addDays(from, days - 1) };
}

export function clampRangeTo(r: DateRange, maxTo: string): DateRange {
  return r.to > maxTo ? { from: r.from > maxTo ? maxTo : r.from, to: maxTo } : r;
}

export function sameRange(a: DateRange, b: DateRange): boolean {
  return a.from === b.from && a.to === b.to;
}
