import { Advice, Analyst, AnalystConfig, DimensionDef, Fact, MetricDef, dates } from "../analyst";
import { HOLDING_STATUSES } from "./aiAnalytics";
import { dayStart, nightRange, nightsBetween, outstandingDebt } from "./bookings";

/*
 * Hotel adapter for the local analyst: describes the domain (metrics,
 * dimensions, vocabulary, advice) and converts bookings / rooms / expenses
 * into facts. This is the only hotel-specific file — the engine in
 * ../analyst knows nothing about rooms or nights.
 *
 * To embed the analyst in another project, write an adapter like this one.
 */

const metrics: MetricDef[] = [
  {
    key: "revenue",
    label: "Выручка",
    unit: "money",
    headline: true,
    synonyms: ["выручка", "доход", "доходы", "продажи", "оборот", "заработали", "заработок", "денег", "revenue", "выручке", "поступления"],
    drivers: ["bookings", "adr", "occupancy"],
  },
  {
    key: "bookings",
    label: "Число броней",
    unit: "count",
    nounForms: ["бронь", "брони", "броней"],
    gender: "n",
    nounGender: "f",
    synonyms: ["брони", "бронь", "бронирования", "бронирований", "заезды", "заездов", "заказы", "гостей", "количество броней", "число броней", "сколько броней"],
  },
  {
    key: "occupancy",
    label: "Загрузка",
    unit: "percent",
    headline: true,
    kind: "formula",
    deps: ["roomNights", "capacity"],
    compute: (s) => (s.capacity > 0 ? Math.min(100, (s.roomNights / s.capacity) * 100) : null),
    synonyms: ["загрузка", "заполняемость", "занятость", "загруженность", "occupancy", "загрузку", "заполнены"],
  },
  {
    key: "adr",
    label: "ADR",
    unit: "money",
    headline: true,
    kind: "formula",
    deps: ["revenue", "nightsSold"],
    compute: (s) => (s.nightsSold > 0 ? s.revenue / s.nightsSold : null),
    synonyms: ["adr", "средний тариф", "средняя цена", "средний чек", "цена за ночь", "тариф", "стоимость ночи", "средняя стоимость"],
  },
  {
    key: "revpar",
    label: "RevPAR",
    unit: "money",
    headline: true,
    kind: "formula",
    deps: ["revenue", "capacity"],
    compute: (s) => (s.capacity > 0 ? s.revenue / s.capacity : null),
    synonyms: ["revpar", "доход на номер", "выручка на номер", "доход с номера"],
  },
  {
    key: "nightsSold",
    label: "Проданные ночи",
    unit: "count",
    nounForms: ["ночь", "ночи", "ночей"],
    synonyms: ["ночей", "ночи", "номеро-ночей", "проданных ночей", "ночевок"],
  },
  {
    key: "cancellations",
    label: "Отмены и незаезды",
    unit: "count",
    nounForms: ["отмена", "отмены", "отмен"],
    higherIsBetter: false,
    synonyms: ["отмены", "отмен", "отмена", "незаезды", "незаезд", "отказы", "no-show", "отменили", "отменённые"],
  },
  {
    key: "cancellationRate",
    label: "Доля отмен",
    unit: "percent",
    higherIsBetter: false,
    kind: "formula",
    deps: ["cancellations", "requests"],
    compute: (s) => (s.requests > 0 ? (s.cancellations / s.requests) * 100 : null),
    synonyms: ["доля отмен", "процент отмен", "уровень отмен"],
  },
  {
    key: "debt",
    label: "Долги гостей",
    unit: "money",
    higherIsBetter: false,
    synonyms: ["долги", "долг", "задолженность", "должники", "не оплачено", "неоплаченные", "дебиторка", "должны"],
  },
  {
    key: "expenses",
    label: "Расходы",
    unit: "money",
    higherIsBetter: false,
    synonyms: ["расходы", "расход", "затраты", "траты", "издержки", "потратили"],
  },
  {
    key: "profit",
    label: "Чистый результат",
    unit: "money",
    gender: "m",
    kind: "formula",
    deps: ["revenue", "expenses"],
    compute: (s) => s.revenue - s.expenses,
    synonyms: ["прибыль", "чистая прибыль", "маржа", "чистый результат", "заработали чистыми", "остаток"],
  },
  {
    key: "capacity",
    label: "Номерной фонд",
    unit: "count",
    nounForms: ["номеро-ночь", "номеро-ночи", "номеро-ночей"],
    synonyms: ["ёмкость", "емкость", "номерной фонд", "доступных ночей"],
  },
];

const dimensions: DimensionDef[] = [
  { key: "source", label: "Канал", labelPlural: "каналам", synonyms: ["канал", "каналы", "каналов", "источник", "источники", "источников", "ота", "площадка", "площадки", "откуда брони"] },
  { key: "roomType", label: "Тип номера", labelPlural: "типам номеров", synonyms: ["тип номера", "типы номеров", "типам номеров", "категория номера", "категории номеров", "по типам"] },
  { key: "branch", label: "Филиал", labelPlural: "филиалам", synonyms: ["филиал", "филиалы", "филиалов", "отель", "отели", "отелей", "объект", "объекты", "гостиница", "гостиницы"] },
  { key: "category", label: "Статья расходов", labelPlural: "статьям расходов", synonyms: ["статья расходов", "статьи расходов", "категории расходов", "по статьям", "на что тратим"] },
];

const advice: Advice[] = [
  {
    id: "soft-days-discount",
    tags: ["occupancy", "revenue", "revpar", "general"],
    priority: 9,
    text: "Дайте тактическую скидку 10–15% только на 2–3 самых слабых дня впереди и уберите её, как только загрузка на них дойдёт до 60%.",
    when: (c) => c.forecast("occupancy", 14).some((p) => p.value < 35),
  },
  {
    id: "weekend-package",
    tags: ["occupancy", "revenue", "general"],
    priority: 8,
    text: "Соберите пакет «2 ночи + завтрак» на выходные и отправьте его гостям, которые уже останавливались у вас в выходные.",
    when: (c) => {
      const wd = c.weekdayProfile("occupancy");
      const we = wd.filter((w) => w.weekday === 5 || w.weekday === 6).map((w) => w.value);
      const wk = wd.filter((w) => w.weekday >= 1 && w.weekday <= 4).map((w) => w.value);
      const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
      return avg(wk) - avg(we) >= 10;
    },
  },
  {
    id: "weekday-corporate",
    tags: ["occupancy", "revenue"],
    priority: 7,
    text: "Будни слабее выходных — предложите корпоративный тариф ближайшим компаниям и скидку со второй ночи для длительных заездов.",
    when: (c) => {
      const wd = c.weekdayProfile("occupancy");
      const we = wd.filter((w) => w.weekday === 5 || w.weekday === 6).map((w) => w.value);
      const wk = wd.filter((w) => w.weekday >= 1 && w.weekday <= 4).map((w) => w.value);
      const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
      return avg(we) - avg(wk) >= 15;
    },
  },
  {
    id: "raise-rate-on-peaks",
    tags: ["revenue", "adr", "revpar"],
    priority: 8,
    text: "На даты с прогнозом загрузки выше 85% поднимите тариф на 10–15% и закройте скидочные каналы — спрос заполнит номера и так.",
    when: (c) => c.forecast("occupancy", 14).some((p) => p.value >= 85),
  },
  {
    id: "direct-channel",
    tags: ["revenue", "general"],
    priority: 6,
    text: "Снизьте зависимость от главного канала: скидка 5% за прямую бронь и напоминание о ней при выезде окупаются за счёт комиссии.",
    when: (c) => {
      const g = c.groups("revenue", "source");
      return g.length > 1 && (g[0].share ?? 0) >= 55;
    },
  },
  {
    id: "prepay",
    tags: ["cancellations", "cancellationRate", "revenue"],
    priority: 8,
    text: "Введите невозвратный тариф с предоплатой и подтверждайте брони за день до заезда — это режет отмены и незаезды вдвое.",
    when: (c) => (c.value("cancellationRate") ?? 0) >= 12,
  },
  {
    id: "collect-debt",
    tags: ["debt", "profit"],
    priority: 9,
    text: "Начните с самых крупных и самых старых долгов: напоминание в день выезда и через неделю возвращает большую часть без конфликтов.",
    when: (c) => (c.value("debt") ?? 0) > 0,
  },
  {
    id: "expenses-review",
    tags: ["expenses", "profit"],
    priority: 7,
    text: "Разберите две крупнейшие статьи расходов — обычно там 70% всех затрат, и именно там есть что пересмотреть.",
    when: (c) => {
      const r = c.value("revenue") ?? 0;
      const e = c.value("expenses") ?? 0;
      return r > 0 && e / r >= 0.6;
    },
  },
  {
    id: "adr-discounts",
    tags: ["adr"],
    priority: 6,
    text: "Средний тариф падает из-за скидочных каналов — ограничьте глубину скидок до 10% и оставьте их только на слабые даты.",
    when: (c) => {
      const cur = c.value("adr");
      const prev = c.value("adr", c.prevRange);
      const d = c.deltaPct(cur, prev);
      return d !== null && d <= -5;
    },
  },
  {
    id: "keep-course",
    tags: ["general"],
    priority: 1,
    text: "Показатели в норме — держите цены, следите за прогнозом на ближайшие две недели и реагируйте на слабые дни точечно.",
  },
];

export function hotelAnalystConfig(overrides: Partial<AnalystConfig> = {}): AnalystConfig {
  return {
    name: "отель",
    currency: "UZS",
    metrics,
    dimensions,
    defaultMetric: "revenue",
    primaryDimension: "source",
    measureLabels: { roomNights: "занятых ночей", capacity: "доступных ночей", nightsSold: "проданных ночей", requests: "всего заявок" },
    advice,
    ...overrides,
  };
}

export function createHotelAnalyst(overrides: Partial<AnalystConfig> = {}): Analyst {
  return new Analyst(hotelAnalystConfig(overrides));
}

// ---------- facts ----------

export interface HotelBookingRow {
  date: Date;
  checkOut: Date | null;
  price: number;
  status: string;
  paymentStatus: string;
  paidAmount: number | null;
  roomId: string;
  source: { name: string };
  branch: { name: string };
  room: { type: string | null };
}
export interface HotelRoomRow {
  id: string;
  branch: { name: string };
}
export interface HotelExpenseRow {
  date: Date;
  amount: number;
  category: string;
  branch: { name: string };
}

/**
 * Bookings → facts. Revenue and counts sit on the check-in day; every night
 * of a stay adds a room-night on its own date, so occupancy is per night.
 * Capacity is one fact per branch per day. Only aggregates — no guest names.
 */
export function hotelFacts(input: { bookings: HotelBookingRow[]; rooms: HotelRoomRow[]; expenses: HotelExpenseRow[]; from: string; to: string }): Fact[] {
  const facts: Fact[] = [];
  const iso = (d: Date) => dates.toIso(dayStart(d));

  for (const b of input.bookings) {
    const dims = { source: b.source.name, branch: b.branch.name, roomType: b.room.type?.trim() || "Без типа" };
    const checkIn = iso(b.date);
    const holding = HOLDING_STATUSES.has(b.status);
    facts.push({ date: checkIn, dims, measures: { requests: 1, cancellations: holding ? 0 : 1 } });
    if (!holding) continue;
    facts.push({
      date: checkIn,
      dims,
      measures: { revenue: b.price, bookings: 1, nightsSold: nightsBetween(b.date, b.checkOut), debt: outstandingDebt(b.price, b.paidAmount) },
    });
    const { start, end } = nightRange(b.date, b.checkOut);
    for (let t = start.getTime(); t < end.getTime(); t += 86_400_000) {
      const night = dates.toIso(new Date(t));
      if (night < input.from || night > input.to) continue;
      facts.push({ date: night, dims, measures: { roomNights: 1 } });
    }
  }

  const roomsByBranch = new Map<string, number>();
  for (const r of input.rooms) roomsByBranch.set(r.branch.name, (roomsByBranch.get(r.branch.name) ?? 0) + 1);
  for (const day of dates.listDays(input.from, input.to)) {
    for (const [branch, n] of roomsByBranch) facts.push({ date: day, dims: { branch }, measures: { capacity: n } });
  }

  for (const e of input.expenses) {
    facts.push({ date: iso(e.date), dims: { branch: e.branch.name, category: e.category }, measures: { expenses: e.amount } });
  }
  return facts;
}
