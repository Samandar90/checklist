import { describe, it, expect } from "vitest";
import { Analyst, AnalystConfig, Fact, genericRules, parseQuestion, stem, tokenize, dates, stats } from "./index";

/*
 * A small synthetic "shop" — deliberately not the hotel — proves the engine
 * is domain-agnostic. 12 weeks of history to 2026-09-10 (today), then a
 * few confirmed future orders.
 */

const TODAY = "2026-09-10";

const config: AnalystConfig = {
  name: "магазин",
  currency: "UZS",
  defaultMetric: "revenue",
  primaryDimension: "channel",
  today: () => dates.parseIso(TODAY),
  measureLabels: { visits: "визитов" },
  metrics: [
    { key: "revenue", label: "Выручка", unit: "money", headline: true, synonyms: ["выручка", "продажи", "оборот", "доход"], drivers: ["orders", "avgCheck"] },
    { key: "orders", label: "Число заказов", unit: "count", nounForms: ["заказ", "заказа", "заказов"], gender: "n", synonyms: ["заказы", "заказов", "заказ", "чеки"] },
    {
      key: "avgCheck",
      label: "Средний чек",
      unit: "money",
      kind: "formula",
      deps: ["revenue", "orders"],
      compute: (s) => (s.orders ? s.revenue / s.orders : null),
      synonyms: ["средний чек", "чек"],
    },
    { key: "refunds", label: "Возвраты", unit: "money", higherIsBetter: false, synonyms: ["возвраты", "возврат"] },
    {
      key: "conversion",
      label: "Конверсия",
      unit: "percent",
      kind: "formula",
      deps: ["orders", "visits"],
      compute: (s) => (s.visits ? (s.orders / s.visits) * 100 : null),
      synonyms: ["конверсия"],
    },
  ],
  dimensions: [
    { key: "channel", label: "Канал", labelPlural: "каналам", synonyms: ["канал", "каналы", "каналов", "источник"] },
    { key: "store", label: "Точка", labelPlural: "точкам", synonyms: ["точка", "точки", "магазин", "магазины"] },
  ],
  advice: [
    { id: "bundle", tags: ["avgCheck", "revenue"], priority: 5, text: "Соберите комплект из двух ходовых товаров со скидкой 5%." },
    { id: "keep", tags: ["general"], priority: 1, text: "Держите курс." },
  ],
};
config.rules = genericRules("revenue", "channel");

function buildFacts(): Fact[] {
  const facts: Fact[] = [];
  const from = dates.addDays(TODAY, -84);
  const days = dates.listDays(from, dates.addDays(TODAY, 14));
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (const day of days) {
    const wd = dates.weekdayOf(day);
    const weekend = wd === 5 || wd === 6;
    const future = day > TODAY;
    // Last 30 days: Telegram collapses, Site holds → revenue drops; average check rises.
    const recent = day > dates.addDays(TODAY, -30);
    const base = weekend ? 12 : 6;
    const channels: [string, number][] = [
      ["Site", base],
      ["Telegram", recent ? 1 : base],
      ["Market", 3],
    ];
    for (const [channel, n] of channels) {
      const orders = future ? Math.round(n * 0.3) : n + Math.round(rnd() * 2);
      if (!orders) continue;
      const check = (recent ? 115_000 : 100_000) * (1 + (rnd() - 0.5) * 0.1);
      facts.push({ date: day, dims: { channel, store: channel === "Market" ? "Юнусабад" : "Центр" }, measures: { revenue: Math.round(orders * check), orders, refunds: recent && channel === "Market" ? 40_000 : 5_000, visits: orders * 10 } });
    }
  }
  // One freak day.
  facts.push({ date: "2026-08-05", dims: { channel: "Site", store: "Центр" }, measures: { revenue: 9_000_000, orders: 60, refunds: 0, visits: 600 } });
  return facts;
}

const analyst = new Analyst(config).load(buildFacts());
const ask = (q: string) => analyst.ask(q);

describe("stem / tokenize", () => {
  it("collapses inflections to one stem", () => {
    expect(stem("выручка")).toBe(stem("выручку"));
    expect(stem("выручкой")).toBe(stem("выручке"));
    expect(stem("каналам")).toBe(stem("каналы"));
    expect(stem("сентябре")).toBe(stem("сентября"));
  });
  it("keeps dotted dates as one token", () => {
    expect(tokenize("выручка 10.09.2026 и вчера")).toEqual(["выручка", "10.09.2026", "и", "вчера"]);
  });
});

describe("parseQuestion", () => {
  const ctx = { metrics: config.metrics, dimensions: analyst.dimensions, dimensionValues: (d: string) => analyst.dataset.dimensionValues(d), today: TODAY };
  it("finds metric, intent and comparison", () => {
    const q = parseQuestion("Почему выручка изменилась по сравнению с прошлым периодом?", ctx);
    expect(q.intent).toBe("why");
    expect(q.metrics[0]).toBe("revenue");
    expect(q.compare).toBe(true);
  });
  it("parses calendar phrases", () => {
    expect(parseQuestion("выручка за прошлый месяц", ctx).range).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(parseQuestion("выручка в сентябре", ctx).range).toEqual({ from: "2026-09-01", to: "2026-09-10" });
    expect(parseQuestion("выручка с 1 по 5 сентября", ctx).range).toEqual({ from: "2026-09-01", to: "2026-09-05" });
    expect(parseQuestion("продажи за 2 недели", ctx).range).toEqual({ from: "2026-08-28", to: "2026-09-10" });
    expect(parseQuestion("сколько заказов вчера", ctx).range).toEqual({ from: "2026-09-09", to: "2026-09-09" });
    expect(parseQuestion("выручка 05.09", ctx).range).toEqual({ from: "2026-09-05", to: "2026-09-05" });
    expect(parseQuestion("выручка за эту неделю", ctx).range).toEqual({ from: "2026-09-07", to: "2026-09-10" });
  });
  it("detects grouping, filters and direction", () => {
    const q = parseQuestion("какой канал приносит больше всего выручки?", ctx);
    expect(q.intent).toBe("rank");
    expect(q.groupBy).toBe("channel");
    expect(q.direction).toBe("top");
    const f = parseQuestion("выручка в Telegram за неделю", ctx);
    expect(f.filter.dims).toEqual({ channel: "Telegram" });
    expect(f.groupBy).toBeUndefined();
    expect(parseQuestion("заказы в выходные", ctx).filter.weekdays).toEqual([5, 6]);
  });
  it("detects forecast horizon and advice", () => {
    const q = parseQuestion("Какие дни в ближайшие две недели самые слабые и что с ними делать?", ctx);
    expect(q.intent).toBe("weakDays");
    expect(q.horizonDays).toBe(14);
    expect(q.wantsAdvice).toBe(true);
    expect(parseQuestion("прогноз продаж на месяц", ctx).horizonDays).toBe(30);
  });
  it("routes several metrics to a comparison", () => {
    const q = parseQuestion("Где мы теряем деньги: возвраты или выручка?", ctx);
    expect(q.intent).toBe("compareMetrics");
    expect(q.metrics).toEqual(["refunds", "revenue"]);
  });
  it("marks nonsense as unknown", () => {
    expect(parseQuestion("привет как погода", ctx).intent).toBe("unknown");
  });
});

describe("Analyst.ask", () => {
  it("answers a value question with a comparison and the top group", () => {
    const a = ask("сколько было выручки за 30 дней?");
    expect(a.intent).toBe("value");
    expect(a.confidence).toBeGreaterThan(0.8);
    expect(a.text).toMatch(/^Выручка за 30 дней:/);
    expect(a.text).toContain("к предыдущему периоду");
    expect(a.text).toContain("Больше всего дал канал «Site»");
    expect(a.followUps.length).toBeGreaterThan(0);
  });

  it("explains a drop through volume, the collapsing channel and drivers", () => {
    const a = ask("почему упала выручка?");
    expect(a.intent).toBe("why");
    expect(a.text).toContain("снизилась");
    expect(a.text).toContain("Главная причина — число заказов");
    expect(a.text).toContain("«Telegram»");
    expect(a.text).toContain("Связанные показатели");
  });

  it("ranks channels with growth and decline", () => {
    const a = ask("какой канал растёт, а какой падает?");
    expect(a.intent).toBe("rank");
    expect(a.text).toContain("«Site»");
    expect(a.text).toContain("падает «Telegram»");
  });

  it("forecasts with a corridor and the confirmed share", () => {
    const a = ask("прогноз выручки на 2 недели");
    expect(a.intent).toBe("forecast");
    expect(a.text).toMatch(/Прогноз: выручка на 2 недели/);
    expect(a.text).toContain("коридор");
    expect(a.text).toContain("Уже подтверждено");
  });

  it("lists weak days ahead and adds advice when asked", () => {
    const a = ask("какие дни впереди самые слабые и что делать?");
    expect(a.intent).toBe("weakDays");
    expect(a.text).toContain("Самые слабые дни");
    expect(a.text).toContain("Что сделать");
  });

  it("describes a trend with a weekly slope", () => {
    const a = ask("динамика выручки за 30 дней");
    expect(a.intent).toBe("trend");
    expect(a.text).toMatch(/в неделю|стабильна/);
    expect(a.text).toContain("Пик —");
  });

  it("finds the freak day", () => {
    const a = ask("были ли необычные дни в августе?");
    expect(a.intent).toBe("anomaly");
    expect(a.text).toContain("5 авг.");
  });

  it("recommends from advice and insights", () => {
    const a = ask("что сделать, чтобы поднять средний чек?");
    expect(a.intent).toBe("recommend");
    expect(a.text).toContain("Соберите комплект");
  });

  it("compares several metrics and names the worst mover", () => {
    const a = ask("где мы теряем деньги: возвраты или выручка?");
    expect(a.intent).toBe("compareMetrics");
    expect(a.text).toContain("Возвраты —");
    expect(a.text).toContain("Больше всего денег уходит через возвраты");
  });

  it("filters by a dimension value found in the data", () => {
    const a = ask("выручка в Telegram за 7 дней");
    expect(a.text).toContain("канал «Telegram»");
    expect(a.confidence).toBeGreaterThan(0.8);
  });

  it("answers a ratio metric with its components", () => {
    const a = ask("какая конверсия за неделю?");
    expect(a.intent).toBe("value");
    expect(a.text).toMatch(/Конверсия за неделю: \d+%/);
    expect(a.text).toContain("В основе");
  });

  it("falls back to help with low confidence on nonsense", () => {
    const a = ask("привет как погода");
    expect(a.intent).toBe("unknown");
    expect(a.confidence).toBeLessThan(0.5);
    expect(a.text).toContain("Не понял вопрос");
  });
});

describe("narrative & insights", () => {
  it("writes a summary with headline metrics, a risk and an action", () => {
    const text = analyst.narrative();
    expect(text).toMatch(/^За последние 30 дней: выручка/);
    expect(text).toContain("Прогноз на 14 дней");
    expect(text).toContain("Действие на неделю");
  });
  it("generic rules flag the revenue drop and the anomaly", () => {
    const ids = analyst.insights().map((i) => i.id);
    expect(ids).toContain("delta:revenue");
    expect(ids.some((i) => i.startsWith("anomaly:"))).toBe(true);
  });
});

describe("stats", () => {
  it("linearTrend sees a rising line", () => {
    const s = Array.from({ length: 14 }, (_, i) => ({ date: dates.addDays("2026-08-01", i), value: 100 + i * 10 }));
    const t = stats.linearTrend(s);
    expect(t.direction).toBe("up");
    expect(t.r2).toBeCloseTo(1, 5);
  });
  it("forecastSeries never drops below the floor and respects max", () => {
    const hist = Array.from({ length: 84 }, (_, i) => ({ date: dates.addDays("2026-06-01", i), value: 50 }));
    const fc = stats.forecastSeries(hist, [{ date: "2026-08-24", value: 80 }], { max: 100 });
    expect(fc[0].value).toBe(80);
    expect(fc[0].high).toBeLessThanOrEqual(100);
  });
});
