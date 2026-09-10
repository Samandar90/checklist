import { dayStart, nightRange, nightsBetween, outstandingDebt } from "./bookings";

/*
 * AI analytics — the deterministic half. Everything here is pure and unit
 * tested: daily series, weekday-seasonal forecast with a confidence band,
 * anomaly detection, KPIs and the rule-based insight feed. The LLM layer
 * (routes/aiAnalytics.ts + lib/claude.ts) only narrates and answers questions
 * over the numbers produced here, so the page is fully useful without a key.
 *
 * Revenue is attributed to the check-in date and cancelled / no-show bookings
 * hold neither money nor nights — the same rules as the dashboard and reports.
 */

const DAY = 24 * 60 * 60 * 1000;
export const HOLDING_STATUSES = new Set(["RESERVED", "CHECKED_IN", "CHECKED_OUT"]);
const WEEKDAY_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export interface AiBooking {
  date: Date;
  checkOut: Date | null;
  price: number;
  status: string;
  paymentStatus: string;
  paidAmount: number | null;
  sourceName: string;
  roomId: string;
}
export interface AiRoom {
  id: string;
  roomNumber: string;
  type?: string | null;
}
export interface AiExpense {
  date: Date;
  amount: number;
  category: string;
}

export interface DayPoint {
  date: string;
  revenue: number;
  bookings: number;
  /** Rooms occupied on this night. */
  occupied: number;
  /** 0–100, occupied / total rooms. */
  occupancy: number;
}
export interface ForecastPoint {
  date: string;
  /** Best estimate — never below what is already booked. */
  revenue: number;
  /** Already-confirmed revenue for the day (bookings on the books). */
  confirmed: number;
  low: number;
  high: number;
  occupancy: number;
}
export interface Anomaly {
  date: string;
  revenue: number;
  expected: number;
  zscore: number;
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
}
export interface Kpis {
  revenue: number;
  prevRevenue: number;
  revenueDeltaPct: number | null;
  occupancy: number;
  prevOccupancy: number;
  adr: number;
  prevAdr: number;
  revpar: number;
  prevRevpar: number;
  bookings: number;
  prevBookings: number;
  cancellationRate: number;
  debt: number;
  expenses: number;
  netProfit: number;
  roomNights: number;
  capacity: number;
  rangeDays: number;
}
export interface SourceShare {
  name: string;
  total: number;
  count: number;
  share: number;
}
export interface WeekdayPoint {
  weekday: number;
  label: string;
  avgRevenue: number;
  avgOccupancy: number;
}
export interface AiOverview {
  range: { from: string; to: string };
  kpis: Kpis;
  series: DayPoint[];
  /** Last 30 days up to today — the "actual" half of the forecast chart. */
  recent: DayPoint[];
  forecast: ForecastPoint[];
  anomalies: Anomaly[];
  insights: Insight[];
  sources: SourceShare[];
  weekdays: WeekdayPoint[];
  idleRooms: AiRoom[];
  /** Rule-based narrative — what the page shows when no AI key is configured. */
  summary: string;
}

// ---------- dates & formatting ----------

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function addDays(d: Date, n: number): Date {
  const x = dayStart(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function daysBetweenInclusive(a: Date, b: Date): number {
  return Math.round((dayStart(b).getTime() - dayStart(a).getTime()) / DAY) + 1;
}
function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}
export function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: abs >= 10_000_000 ? 0 : 1 })} млн`;
  }
  if (abs >= 1000) return `${Math.round(n / 1000).toLocaleString("ru-RU")} тыс`;
  return Math.round(n).toLocaleString("ru-RU");
}
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
const pct = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export function deltaPct(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

// ---------- daily series ----------

export function buildDailySeries(bookings: AiBooking[], rooms: number, from: Date, to: Date): DayPoint[] {
  const start = dayStart(from);
  const n = daysBetweenInclusive(start, to);
  if (n <= 0) return [];
  const points: DayPoint[] = Array.from({ length: n }, (_, i) => ({
    date: dayKey(addDays(start, i)),
    revenue: 0,
    bookings: 0,
    occupied: 0,
    occupancy: 0,
  }));
  const startMs = start.getTime();
  const endMs = addDays(start, n).getTime();
  for (const b of bookings) {
    if (!HOLDING_STATUSES.has(b.status)) continue;
    const idx = Math.round((dayStart(b.date).getTime() - startMs) / DAY);
    if (idx >= 0 && idx < n) {
      points[idx].revenue += b.price;
      points[idx].bookings += 1;
    }
    const { start: ns, end: ne } = nightRange(b.date, b.checkOut);
    const a = Math.max(ns.getTime(), startMs);
    const z = Math.min(ne.getTime(), endMs);
    for (let t = a; t < z; t += DAY) {
      const i = Math.round((t - startMs) / DAY);
      if (i >= 0 && i < n) points[i].occupied += 1;
    }
  }
  if (rooms > 0) for (const p of points) p.occupancy = Math.min(100, Math.round((p.occupied / rooms) * 100));
  return points;
}

export function sliceSeries(series: DayPoint[], from: Date, to: Date): DayPoint[] {
  const a = dayKey(dayStart(from));
  const b = dayKey(dayStart(to));
  return series.filter((p) => p.date >= a && p.date <= b);
}

// ---------- seasonality, forecast, anomalies ----------

export interface WeekdayStat {
  n: number;
  meanRev: number;
  stdRev: number;
  meanOcc: number;
}

export function weekdayStats(history: DayPoint[]): WeekdayStat[] {
  const rev: number[][] = Array.from({ length: 7 }, () => []);
  const occ: number[][] = Array.from({ length: 7 }, () => []);
  for (const p of history) {
    const wd = weekdayOf(p.date);
    rev[wd].push(p.revenue);
    occ[wd].push(p.occupancy);
  }
  return rev.map((xs, wd) => {
    const n = xs.length;
    const meanRev = avg(xs);
    const variance = n > 1 ? xs.reduce((s, x) => s + (x - meanRev) ** 2, 0) / (n - 1) : 0;
    return { n, meanRev, stdRev: Math.sqrt(variance), meanOcc: avg(occ[wd]) };
  });
}

/**
 * Momentum: mean revenue of the last 4 weeks over the 4 weeks before them,
 * clamped so one freak week cannot double the forecast.
 */
export function trendFactor(history: DayPoint[]): number {
  if (history.length < 42) return 1;
  const last = history.slice(-28);
  const prev = history.slice(-56, -28);
  if (prev.length < 14) return 1;
  const b = avg(prev.map((p) => p.revenue));
  if (b <= 0) return 1;
  return clamp(avg(last.map((p) => p.revenue)) / b, 0.6, 1.6);
}

/**
 * Weekday-seasonal forecast: same-weekday mean × momentum, floored at what is
 * already on the books, with a ±1σ band. Deliberately simple and explainable —
 * the insight feed quotes these numbers, so they must be defensible.
 */
export function buildForecast(history: DayPoint[], confirmed: DayPoint[]): ForecastPoint[] {
  const wd = weekdayStats(history);
  const trend = trendFactor(history);
  return confirmed.map((p) => {
    const s = wd[weekdayOf(p.date)];
    const stat = s.n ? s.meanRev * trend : 0;
    const spread = s.n > 1 ? s.stdRev * trend : stat * 0.3;
    const revenue = Math.max(stat, p.revenue);
    const low = Math.max(p.revenue, stat - spread, 0);
    const high = Math.max(revenue, stat + spread);
    const occupancy = clamp(Math.round(Math.max(s.meanOcc * trend, p.occupancy)), 0, 100);
    return {
      date: p.date,
      revenue: Math.round(revenue),
      confirmed: Math.round(p.revenue),
      low: Math.round(low),
      high: Math.round(high),
      occupancy,
    };
  });
}

/** Days whose revenue sits ≥ 2σ away from the same-weekday mean. */
export function detectAnomalies(history: DayPoint[], limit = 5): Anomaly[] {
  const wd = weekdayStats(history);
  const out: Anomaly[] = [];
  for (const p of history) {
    const s = wd[weekdayOf(p.date)];
    if (s.n < 3 || s.stdRev <= 0) continue;
    const z = (p.revenue - s.meanRev) / s.stdRev;
    if (Math.abs(z) >= 2) {
      out.push({ date: p.date, revenue: p.revenue, expected: Math.round(s.meanRev), zscore: Math.round(z * 10) / 10 });
    }
  }
  return out.sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore)).slice(0, limit);
}

export function weekdayProfile(history: DayPoint[]): WeekdayPoint[] {
  const wd = weekdayStats(history);
  // Monday-first, the way a hotel week is read.
  return [1, 2, 3, 4, 5, 6, 0].map((i) => ({
    weekday: i,
    label: WEEKDAY_SHORT[i],
    avgRevenue: Math.round(wd[i].meanRev),
    avgOccupancy: Math.round(wd[i].meanOcc),
  }));
}

// ---------- KPIs & mix ----------

function checkInWithin(b: AiBooking, from: Date, to: Date): boolean {
  const k = dayKey(dayStart(b.date));
  return k >= dayKey(dayStart(from)) && k <= dayKey(dayStart(to));
}

export function computeKpis(args: {
  current: DayPoint[];
  previous: DayPoint[];
  bookings: AiBooking[];
  rooms: number;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  expenses: AiExpense[];
}): Kpis {
  const { current, previous, bookings, rooms, from, to, prevFrom, prevTo, expenses } = args;
  const sum = (xs: DayPoint[], k: "revenue" | "occupied") => xs.reduce((s, p) => s + p[k], 0);

  const revenue = sum(current, "revenue");
  const prevRevenue = sum(previous, "revenue");
  const roomNights = sum(current, "occupied");
  const prevRoomNights = sum(previous, "occupied");
  const capacity = rooms * current.length;
  const prevCapacity = rooms * previous.length;
  const occupancy = capacity ? (roomNights / capacity) * 100 : 0;
  const prevOccupancy = prevCapacity ? (prevRoomNights / prevCapacity) * 100 : 0;

  let nightsSold = 0;
  let prevNightsSold = 0;
  let count = 0;
  let prevCount = 0;
  let all = 0;
  let lost = 0;
  let debt = 0;
  for (const b of bookings) {
    const holding = HOLDING_STATUSES.has(b.status);
    if (checkInWithin(b, from, to)) {
      all += 1;
      if (holding) {
        count += 1;
        nightsSold += nightsBetween(b.date, b.checkOut);
        debt += outstandingDebt(b.price, b.paidAmount);
      } else lost += 1;
    } else if (holding && checkInWithin(b, prevFrom, prevTo)) {
      prevCount += 1;
      prevNightsSold += nightsBetween(b.date, b.checkOut);
    }
  }

  const inRange = (e: AiExpense, a: Date, z: Date) => {
    const k = dayKey(dayStart(e.date));
    return k >= dayKey(dayStart(a)) && k <= dayKey(dayStart(z));
  };
  const expensesTotal = expenses.filter((e) => inRange(e, from, to)).reduce((s, e) => s + e.amount, 0);

  return {
    revenue,
    prevRevenue,
    revenueDeltaPct: deltaPct(revenue, prevRevenue),
    occupancy: Math.round(occupancy * 10) / 10,
    prevOccupancy: Math.round(prevOccupancy * 10) / 10,
    adr: nightsSold ? Math.round(revenue / nightsSold) : 0,
    prevAdr: prevNightsSold ? Math.round(prevRevenue / prevNightsSold) : 0,
    revpar: capacity ? Math.round(revenue / capacity) : 0,
    prevRevpar: prevCapacity ? Math.round(prevRevenue / prevCapacity) : 0,
    bookings: count,
    prevBookings: prevCount,
    cancellationRate: all ? Math.round((lost / all) * 1000) / 10 : 0,
    debt,
    expenses: expensesTotal,
    netProfit: revenue - expensesTotal,
    roomNights,
    capacity,
    rangeDays: current.length,
  };
}

export function sourceShares(bookings: AiBooking[], from: Date, to: Date): SourceShare[] {
  const map = new Map<string, { total: number; count: number }>();
  let grand = 0;
  for (const b of bookings) {
    if (!HOLDING_STATUSES.has(b.status) || !checkInWithin(b, from, to)) continue;
    const cur = map.get(b.sourceName) ?? { total: 0, count: 0 };
    cur.total += b.price;
    cur.count += 1;
    grand += b.price;
    map.set(b.sourceName, cur);
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, total: v.total, count: v.count, share: grand ? Math.round((v.total / grand) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);
}

// ---------- the insight feed ----------

export function generateInsights(ctx: {
  kpis: Kpis;
  forecast: ForecastPoint[];
  anomalies: Anomaly[];
  sources: SourceShare[];
  weekdays: WeekdayPoint[];
  idleRooms: AiRoom[];
  totalRooms: number;
}): Insight[] {
  const { kpis: k, forecast, anomalies, sources, weekdays, idleRooms, totalRooms } = ctx;
  const out: Insight[] = [];

  // Revenue vs the previous period of equal length.
  if (k.revenueDeltaPct !== null && Math.abs(k.revenueDeltaPct) >= 10) {
    const up = k.revenueDeltaPct > 0;
    out.push({
      id: "revenue-delta",
      kind: up ? "trend" : "risk",
      severity: up ? "good" : "warning",
      title: up ? `Выручка выросла на ${pct(k.revenueDeltaPct)}` : `Выручка снизилась на ${pct(k.revenueDeltaPct)}`,
      detail: `${fmtMoney(k.revenue)} против ${fmtMoney(k.prevRevenue)} за предыдущие ${k.rangeDays} дн. ${
        up ? "Темп стоит закрепить — проверьте, какие каналы дали прирост." : "Загрузка " + Math.round(k.occupancy) + "% при ADR " + fmtMoney(k.adr) + " — смотрите, что просело: спрос или цена."
      }`,
      metric: pct(k.revenueDeltaPct),
      link: "/analytics",
    });
  }

  // Occupancy level.
  if (k.capacity > 0) {
    if (k.occupancy < 40) {
      out.push({
        id: "occupancy-low",
        kind: "risk",
        severity: k.occupancy < 25 ? "critical" : "warning",
        title: `Низкая загрузка — ${Math.round(k.occupancy)}%`,
        detail: `Из ${k.capacity} номеро-ночей продано ${k.roomNights}. Обычный рычаг — тактическая скидка на 2–3 слабых дня и активность в самом сильном канале (${sources[0]?.name ?? "—"}).`,
        metric: `${Math.round(k.occupancy)}%`,
        link: "/calendar",
      });
    } else if (k.occupancy >= 85) {
      out.push({
        id: "occupancy-high",
        kind: "opportunity",
        severity: "good",
        title: `Высокий спрос — загрузка ${Math.round(k.occupancy)}%`,
        detail: `При такой загрузке цена, а не объём, двигает выручку: поднимите тариф на пиковые даты на 10–15% и уберите скидки в выходные.`,
        metric: `${Math.round(k.occupancy)}%`,
        link: "/calendar",
      });
    }
  }

  // Weekend vs weekday gap.
  const weekend = weekdays.filter((w) => w.weekday === 5 || w.weekday === 6);
  const weekday = weekdays.filter((w) => w.weekday >= 1 && w.weekday <= 4);
  const weOcc = avg(weekend.map((w) => w.avgOccupancy));
  const wdOcc = avg(weekday.map((w) => w.avgOccupancy));
  if (weekend.length && weekday.length && (weOcc > 0 || wdOcc > 0)) {
    if (wdOcc - weOcc >= 15) {
      out.push({
        id: "weekend-gap",
        kind: "opportunity",
        severity: "warning",
        title: "Выходные проседают",
        detail: `Пятница–суббота в среднем ${Math.round(weOcc)}% против ${Math.round(wdOcc)}% в будни. Пакет «2 ночи + завтрак» или рассылка прошлым гостям выходного дня закрывают именно этот провал.`,
        metric: `−${Math.round(wdOcc - weOcc)} п.п.`,
      });
    } else if (weOcc - wdOcc >= 20) {
      out.push({
        id: "weekday-gap",
        kind: "opportunity",
        severity: "neutral",
        title: "Будни слабее выходных",
        detail: `Будни ${Math.round(wdOcc)}% против ${Math.round(weOcc)}% в выходные — есть смысл в корпоративных тарифах и длительных заездах со скидкой со второй ночи.`,
        metric: `−${Math.round(weOcc - wdOcc)} п.п.`,
      });
    }
  }

  // Forecast: soft days ahead / peak days ahead.
  const soft = forecast.filter((f) => f.occupancy < 35);
  if (forecast.length && soft.length >= 3) {
    out.push({
      id: "forecast-soft",
      kind: "risk",
      severity: "warning",
      title: `Слабые дни впереди: ${soft.slice(0, 4).map((f) => fmtDate(f.date)).join(", ")}${soft.length > 4 ? "…" : ""}`,
      detail: `Прогноз загрузки ниже 35% на ${soft.length} из ${forecast.length} ближайших дней. Подтверждено пока ${fmtMoney(soft.reduce((s, f) => s + f.confirmed, 0))}. Самое время для акции с ограниченным сроком.`,
      metric: `${soft.length} дн.`,
      link: "/calendar",
    });
  }
  const peak = forecast.filter((f) => f.occupancy >= 90);
  if (peak.length) {
    out.push({
      id: "forecast-peak",
      kind: "opportunity",
      severity: "good",
      title: `Пик спроса: ${peak.slice(0, 4).map((f) => fmtDate(f.date)).join(", ")}${peak.length > 4 ? "…" : ""}`,
      detail: `Ожидаемая загрузка ≥ 90%. На эти даты держите цену выше средней и не принимайте скидочные брони — спрос заполнит номера и так.`,
      metric: `${peak.length} дн.`,
      link: "/calendar",
    });
  }

  // Cancellations.
  if (k.cancellationRate >= 15) {
    out.push({
      id: "cancellations",
      kind: "risk",
      severity: k.cancellationRate >= 30 ? "critical" : "warning",
      title: `Отмены и незаезды — ${k.cancellationRate}% броней`,
      detail: `Каждая ${Math.max(2, Math.round(100 / k.cancellationRate))}-я бронь не превращается в заезд. Помогают предоплата на невозвратном тарифе и подтверждение за день до заезда.`,
      metric: `${k.cancellationRate}%`,
      link: "/reports",
    });
  }

  // Receivables.
  if (k.revenue > 0 && k.debt / k.revenue >= 0.1) {
    const share = Math.round((k.debt / k.revenue) * 100);
    out.push({
      id: "debt",
      kind: "risk",
      severity: share >= 25 ? "critical" : "warning",
      title: `Долги гостей — ${share}% выручки`,
      detail: `Не оплачено ${fmtMoney(k.debt)}. Это деньги, которые уже заработаны, но ещё не в кассе — начните с самых крупных и самых старых.`,
      metric: fmtMoney(k.debt),
      link: "/debtors",
    });
  }

  // Channel concentration.
  if (sources.length >= 2 && sources[0].share >= 60) {
    out.push({
      id: "source-concentration",
      kind: "risk",
      severity: "neutral",
      title: `Зависимость от канала «${sources[0].name}» — ${sources[0].share}%`,
      detail: `Один источник даёт больше половины выручки. Если его условия изменятся, пострадает весь отель — развивайте прямые брони и второй канал (${sources[1].name}, ${sources[1].share}%).`,
      metric: `${sources[0].share}%`,
      link: "/sources",
    });
  }

  // Expenses eating margin.
  if (k.revenue > 0 && k.expenses / k.revenue >= 0.7) {
    out.push({
      id: "expenses",
      kind: "risk",
      severity: k.expenses >= k.revenue ? "critical" : "warning",
      title: `Расходы — ${Math.round((k.expenses / k.revenue) * 100)}% выручки`,
      detail: `${fmtMoney(k.expenses)} расходов при ${fmtMoney(k.revenue)} выручки; чистый результат ${fmtMoney(k.netProfit)}. Разберите крупнейшие категории в финансовом центре.`,
      metric: fmtMoney(k.netProfit),
      link: "/finance",
    });
  }

  // Idle inventory.
  if (idleRooms.length && totalRooms > 0 && k.occupancy >= 30 && idleRooms.length / totalRooms >= 0.15) {
    out.push({
      id: "idle-rooms",
      kind: "info",
      severity: "neutral",
      title: `Простаивают номера: ${idleRooms.slice(0, 5).map((r) => r.roomNumber).join(", ")}${idleRooms.length > 5 ? "…" : ""}`,
      detail: `${idleRooms.length} из ${totalRooms} номеров не продавались весь период при общей загрузке ${Math.round(k.occupancy)}%. Проверьте их цену, фотографии в каналах и не заблокированы ли они на уборку.`,
      metric: `${idleRooms.length} шт.`,
      link: "/rooms",
    });
  }

  // ADR momentum.
  const adrDelta = deltaPct(k.adr, k.prevAdr);
  if (adrDelta !== null && Math.abs(adrDelta) >= 8) {
    const up = adrDelta > 0;
    out.push({
      id: "adr",
      kind: up ? "trend" : "risk",
      severity: up ? "good" : "warning",
      title: up ? `Средний тариф вырос на ${pct(adrDelta)}` : `Средний тариф упал на ${pct(adrDelta)}`,
      detail: `ADR ${fmtMoney(k.adr)} против ${fmtMoney(k.prevAdr)}. ${up ? "Рост цены при загрузке " + Math.round(k.occupancy) + "% — здоровый сигнал." : "Скидки продают ночи дешевле — проверьте, не ушёл ли объём в дисконтные каналы."}`,
      metric: pct(adrDelta),
    });
  }

  // The most unusual day.
  const a = anomalies[0];
  if (a) {
    const up = a.revenue > a.expected;
    out.push({
      id: "anomaly",
      kind: "anomaly",
      severity: up ? "good" : "warning",
      title: `Необычный день — ${fmtDate(a.date)}`,
      detail: `Выручка ${fmtMoney(a.revenue)} при обычных ${fmtMoney(a.expected)} для этого дня недели (${Math.abs(a.zscore)}σ). ${up ? "Стоит понять причину и повторить." : "Проверьте, не было ли отмен или проблем с каналами."}`,
      metric: `${a.zscore > 0 ? "+" : ""}${a.zscore}σ`,
      link: "/reports",
    });
  }

  const rank: Record<InsightSeverity, number> = { critical: 0, warning: 1, good: 2, neutral: 3 };
  return out.sort((x, y) => rank[x.severity] - rank[y.severity]).slice(0, 8);
}

export function deterministicSummary(k: Kpis, insights: Insight[]): string {
  const parts: string[] = [];
  const delta = k.revenueDeltaPct === null ? "без базы для сравнения" : `${pct(k.revenueDeltaPct)} к прошлому периоду`;
  parts.push(
    `За ${k.rangeDays} дн. выручка ${fmtMoney(k.revenue)} (${delta}), загрузка ${Math.round(k.occupancy)}%, ADR ${fmtMoney(k.adr)}, RevPAR ${fmtMoney(k.revpar)}.`
  );
  const risk = insights.find((i) => i.kind === "risk");
  const opp = insights.find((i) => i.kind === "opportunity" || i.kind === "trend");
  if (risk) parts.push(`Главный риск: ${risk.title.toLowerCase()}.`);
  if (opp) parts.push(`Возможность: ${opp.title.toLowerCase()}.`);
  if (!risk && !opp) parts.push("Отклонений от нормы не видно — период прошёл ровно.");
  return parts.join(" ");
}

// ---------- orchestration ----------

export function buildOverview(input: {
  bookings: AiBooking[];
  rooms: AiRoom[];
  expenses: AiExpense[];
  from: Date;
  to: Date;
  today: Date;
  horizonDays?: number;
}): AiOverview {
  const { bookings, rooms, expenses } = input;
  const from = dayStart(input.from);
  const to = dayStart(input.to);
  const today = dayStart(input.today);
  const horizonDays = input.horizonDays ?? 14;

  const rangeDays = daysBetweenInclusive(from, to);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(rangeDays - 1));
  // 12 weeks of history feeds the weekday profile and the anomaly baseline.
  const historyStart = new Date(Math.min(prevFrom.getTime(), addDays(today, -84).getTime()));
  const horizonEnd = addDays(today, horizonDays);

  const full = buildDailySeries(bookings, rooms.length, historyStart, horizonEnd);
  const current = sliceSeries(full, from, to);
  const previous = sliceSeries(full, prevFrom, prevTo);
  const history = sliceSeries(full, historyStart, addDays(today, -1));
  const recent = sliceSeries(full, addDays(today, -29), today);
  const future = sliceSeries(full, addDays(today, 1), horizonEnd);

  const kpis = computeKpis({ current, previous, bookings, rooms: rooms.length, from, to, prevFrom, prevTo, expenses });
  const forecast = buildForecast(history, future);
  const anomalies = detectAnomalies(history);
  const sources = sourceShares(bookings, from, to);
  const weekdays = weekdayProfile(history);

  // Rooms that sold no night inside the window.
  const busy = new Set<string>();
  const fromMs = from.getTime();
  const toMs = addDays(to, 1).getTime();
  for (const b of bookings) {
    if (!HOLDING_STATUSES.has(b.status)) continue;
    const { start, end } = nightRange(b.date, b.checkOut);
    if (start.getTime() < toMs && end.getTime() > fromMs) busy.add(b.roomId);
  }
  const idleRooms = rooms.filter((r) => !busy.has(r.id));

  const insights = generateInsights({ kpis, forecast, anomalies, sources, weekdays, idleRooms, totalRooms: rooms.length });
  const summary = deterministicSummary(kpis, insights);

  return {
    range: { from: dayKey(from), to: dayKey(to) },
    kpis,
    series: current,
    recent,
    forecast,
    anomalies,
    insights,
    sources,
    weekdays,
    idleRooms,
    summary,
  };
}

/**
 * Compact, PII-free view of the overview for the language model — aggregates
 * only, never guest names. Small enough (a few KB) to send on every question.
 */
export function toLlmContext(o: AiOverview): Record<string, unknown> {
  const k = o.kpis;
  return {
    период: o.range,
    показатели: {
      выручка: Math.round(k.revenue),
      выручка_прошлый_период: Math.round(k.prevRevenue),
      изменение_выручки_пц: k.revenueDeltaPct === null ? null : Math.round(k.revenueDeltaPct),
      загрузка_пц: k.occupancy,
      загрузка_прошлый_период_пц: k.prevOccupancy,
      ADR: k.adr,
      ADR_прошлый_период: k.prevAdr,
      RevPAR: k.revpar,
      RevPAR_прошлый_период: k.prevRevpar,
      броней: k.bookings,
      броней_прошлый_период: k.prevBookings,
      отмены_и_незаезды_пц: k.cancellationRate,
      долг_гостей: Math.round(k.debt),
      расходы: Math.round(k.expenses),
      чистый_результат: Math.round(k.netProfit),
      номеро_ночей_продано: k.roomNights,
      номеро_ночей_доступно: k.capacity,
    },
    инсайты: o.insights.map((i) => ({ тип: i.kind, важность: i.severity, заголовок: i.title, детали: i.detail })),
    прогноз_14_дней: o.forecast.map((f) => ({ дата: f.date, выручка: f.revenue, подтверждено: f.confirmed, загрузка_пц: f.occupancy })),
    аномалии: o.anomalies,
    источники: o.sources,
    средние_по_дням_недели: o.weekdays,
    последние_14_дней: o.recent.slice(-14).map((p) => ({ дата: p.date, выручка: Math.round(p.revenue), загрузка_пц: p.occupancy, броней: p.bookings })),
    простаивающие_номера: o.idleRooms.map((r) => r.roomNumber),
  };
}
