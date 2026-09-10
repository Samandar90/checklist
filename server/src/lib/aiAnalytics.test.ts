import { describe, it, expect } from "vitest";
import {
  buildDailySeries,
  buildForecast,
  detectAnomalies,
  computeKpis,
  generateInsights,
  buildOverview,
  deterministicSummary,
  trendFactor,
  weekdayProfile,
  sourceShares,
  addDays,
  dayKey,
  type AiBooking,
  type DayPoint,
} from "./aiAnalytics";

const d = (iso: string) => new Date(`${iso}T00:00:00`);
const booking = (over: Partial<AiBooking> & { date: string; checkOut?: string | null }): AiBooking => ({
  date: d(over.date),
  checkOut: over.checkOut ? d(over.checkOut) : null,
  price: over.price ?? 100_000,
  status: over.status ?? "RESERVED",
  paymentStatus: over.paymentStatus ?? "Оплачено",
  paidAmount: over.paidAmount ?? null,
  sourceName: over.sourceName ?? "Booking",
  roomId: over.roomId ?? "r1",
});

describe("buildDailySeries", () => {
  it("attributes revenue to the check-in day and nights to each night of the stay", () => {
    const s = buildDailySeries([booking({ date: "2026-09-02", checkOut: "2026-09-05", price: 300 })], 10, d("2026-09-01"), d("2026-09-06"));
    expect(s.map((p) => p.revenue)).toEqual([0, 300, 0, 0, 0, 0]);
    expect(s.map((p) => p.occupied)).toEqual([0, 1, 1, 1, 0, 0]);
    expect(s[1].occupancy).toBe(10);
  });

  it("ignores cancellations and no-shows for both money and nights", () => {
    const s = buildDailySeries(
      [booking({ date: "2026-09-02", checkOut: "2026-09-04", status: "CANCELLED" }), booking({ date: "2026-09-02", status: "NO_SHOW" })],
      5,
      d("2026-09-01"),
      d("2026-09-05")
    );
    expect(s.every((p) => p.revenue === 0 && p.occupied === 0)).toBe(true);
  });

  it("clamps stays that start before or end after the window", () => {
    const s = buildDailySeries([booking({ date: "2026-08-30", checkOut: "2026-09-03" })], 1, d("2026-09-01"), d("2026-09-02"));
    expect(s.map((p) => p.occupied)).toEqual([1, 1]);
    expect(s.map((p) => p.revenue)).toEqual([0, 0]); // check-in outside the window
  });
});

/** 12 weeks of a stable weekly pattern: weekends 900, weekdays 300. */
function weeklyHistory(weeks = 12, start = "2026-06-08"): DayPoint[] {
  const out: DayPoint[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(d(start), i);
    const wd = day.getDay();
    const weekend = wd === 5 || wd === 6;
    out.push({ date: dayKey(day), revenue: weekend ? 900 : 300, bookings: 1, occupied: weekend ? 9 : 3, occupancy: weekend ? 90 : 30 });
  }
  return out;
}

describe("buildForecast", () => {
  it("follows the weekday profile and never drops below confirmed revenue", () => {
    const history = weeklyHistory();
    const future = [
      { date: "2026-09-04", revenue: 0, bookings: 0, occupied: 0, occupancy: 0 }, // Friday
      { date: "2026-09-07", revenue: 1500, bookings: 2, occupied: 2, occupancy: 20 }, // Monday, already sold above trend
    ];
    const f = buildForecast(history, future);
    expect(f[0].revenue).toBe(900);
    expect(f[0].occupancy).toBe(90);
    expect(f[1].revenue).toBe(1500); // floored at confirmed
    expect(f[1].low).toBe(1500);
    expect(f[1].high).toBeGreaterThanOrEqual(1500);
  });

  it("returns a flat 0 estimate with no history", () => {
    const f = buildForecast([], [{ date: "2026-09-04", revenue: 0, bookings: 0, occupied: 0, occupancy: 0 }]);
    expect(f[0].revenue).toBe(0);
    expect(f[0].high).toBe(0);
  });
});

describe("trendFactor", () => {
  it("is 1 with too little history and clamped to [0.6, 1.6] otherwise", () => {
    expect(trendFactor(weeklyHistory(3))).toBe(1);
    const boom = weeklyHistory(8).map((p, i) => ({ ...p, revenue: i >= 28 ? p.revenue * 5 : p.revenue }));
    expect(trendFactor(boom)).toBe(1.6);
    const bust = weeklyHistory(8).map((p, i) => ({ ...p, revenue: i >= 28 ? 0 : p.revenue }));
    expect(trendFactor(bust)).toBe(0.6);
  });
});

describe("detectAnomalies", () => {
  it("flags a day far from its weekday mean and ranks by |z|", () => {
    const history = weeklyHistory().map((p) => (p.date === "2026-07-15" ? { ...p, revenue: 3000 } : p)); // a Wednesday
    // Give the Wednesday bucket some natural variance so σ > 0.
    const noisy = history.map((p, i) => (new Date(p.date).getDay() === 3 && i % 2 === 0 ? { ...p, revenue: p.revenue + 20 } : p));
    const a = detectAnomalies(noisy);
    expect(a[0].date).toBe("2026-07-15");
    expect(a[0].zscore).toBeGreaterThan(2);
    expect(a[0].expected).toBeLessThan(1000);
  });

  it("is silent on a perfectly regular series", () => {
    expect(detectAnomalies(weeklyHistory())).toEqual([]);
  });
});

describe("computeKpis", () => {
  it("computes ADR from nights sold and RevPAR from capacity", () => {
    const bookings = [
      booking({ date: "2026-09-02", checkOut: "2026-09-04", price: 400 }), // 2 nights
      booking({ date: "2026-09-03", price: 100 }), // 1 night
      booking({ date: "2026-09-03", status: "CANCELLED", price: 999 }),
      booking({ date: "2026-08-28", checkOut: "2026-08-29", price: 200 }), // previous period
    ];
    const from = d("2026-09-01");
    const to = d("2026-09-05");
    const current = buildDailySeries(bookings, 2, from, to);
    const previous = buildDailySeries(bookings, 2, d("2026-08-27"), d("2026-08-31"));
    const k = computeKpis({ current, previous, bookings, rooms: 2, from, to, prevFrom: d("2026-08-27"), prevTo: d("2026-08-31"), expenses: [] });
    expect(k.revenue).toBe(500);
    expect(k.adr).toBe(Math.round(500 / 3));
    expect(k.capacity).toBe(10);
    expect(k.revpar).toBe(50);
    expect(k.bookings).toBe(2);
    expect(k.cancellationRate).toBe(33.3);
    expect(k.prevRevenue).toBe(200);
    expect(k.revenueDeltaPct).toBe(150);
  });

  it("counts outstanding debt only on holding bookings", () => {
    const bookings = [
      booking({ date: "2026-09-02", price: 1000, paymentStatus: "Долг", paidAmount: 0 }),
      booking({ date: "2026-09-02", price: 1000, paymentStatus: "Частично", paidAmount: 400 }),
      booking({ date: "2026-09-02", price: 1000, paymentStatus: "Долг", paidAmount: 0, status: "CANCELLED" }),
    ];
    const from = d("2026-09-01");
    const to = d("2026-09-03");
    const k = computeKpis({ current: buildDailySeries(bookings, 3, from, to), previous: [], bookings, rooms: 3, from, to, prevFrom: d("2026-08-29"), prevTo: d("2026-08-31"), expenses: [] });
    expect(k.debt).toBe(1600);
  });
});

describe("generateInsights", () => {
  const base = () => {
    const from = d("2026-09-01");
    const to = d("2026-09-30");
    const bookings: AiBooking[] = [];
    const k = computeKpis({ current: buildDailySeries(bookings, 10, from, to), previous: [], bookings, rooms: 10, from, to, prevFrom: d("2026-08-02"), prevTo: d("2026-08-31"), expenses: [] });
    return { kpis: k, forecast: [], anomalies: [], sources: [], weekdays: weekdayProfile([]), idleRooms: [], totalRooms: 10 };
  };

  it("flags critical low occupancy and orders it first", () => {
    const ctx = base();
    ctx.kpis = { ...ctx.kpis, occupancy: 12, capacity: 300, roomNights: 36, revenue: 100, debt: 50, prevAdr: 0 };
    const ins = generateInsights(ctx);
    expect(ins[0].id).toBe("occupancy-low");
    expect(ins[0].severity).toBe("critical");
    // debt at 50% of revenue is critical too and must sit before warnings
    expect(ins.find((i) => i.id === "debt")?.severity).toBe("critical");
  });

  it("flags channel concentration and a weekend gap", () => {
    const ctx = base();
    ctx.sources = [
      { name: "Booking", total: 800, count: 8, share: 80 },
      { name: "Direct", total: 200, count: 2, share: 20 },
    ];
    ctx.weekdays = weekdayProfile(weeklyHistory().map((p) => ({ ...p, occupancy: p.occupancy === 90 ? 20 : 60 })));
    const ins = generateInsights(ctx);
    expect(ins.some((i) => i.id === "source-concentration")).toBe(true);
    expect(ins.some((i) => i.id === "weekend-gap")).toBe(true);
  });

  it("stays quiet on a healthy period", () => {
    const ctx = base();
    ctx.kpis = { ...ctx.kpis, occupancy: 65, capacity: 300, roomNights: 195, revenue: 1000, prevRevenue: 980, revenueDeltaPct: 2, adr: 100, prevAdr: 98 };
    expect(generateInsights(ctx)).toEqual([]);
  });
});

describe("buildOverview + summary", () => {
  it("produces a coherent overview end to end", () => {
    const today = d("2026-09-10");
    const bookings = [
      booking({ date: "2026-09-02", checkOut: "2026-09-05", price: 3_000_000, roomId: "r1", sourceName: "Booking" }),
      booking({ date: "2026-09-08", checkOut: "2026-09-09", price: 800_000, roomId: "r2", sourceName: "Telegram" }),
      booking({ date: "2026-09-14", checkOut: "2026-09-16", price: 1_200_000, roomId: "r1" }), // future, confirmed
    ];
    const o = buildOverview({
      bookings,
      rooms: [
        { id: "r1", roomNumber: "101" },
        { id: "r2", roomNumber: "102" },
        { id: "r3", roomNumber: "103" },
      ],
      expenses: [{ date: d("2026-09-03"), amount: 500_000, category: "Аренда" }],
      from: d("2026-09-01"),
      to: d("2026-09-10"),
      today,
    });
    expect(o.range).toEqual({ from: "2026-09-01", to: "2026-09-10" });
    expect(o.kpis.revenue).toBe(3_800_000);
    expect(o.kpis.expenses).toBe(500_000);
    expect(o.forecast).toHaveLength(14);
    expect(o.forecast.find((f) => f.date === "2026-09-14")?.confirmed).toBe(1_200_000);
    expect(o.idleRooms.map((r) => r.roomNumber)).toEqual(["103"]);
    expect(o.sources[0]).toMatchObject({ name: "Booking", share: 79 });
    expect(o.recent).toHaveLength(30);
    expect(o.summary).toContain("выручка 3,8 млн");
  });

  it("summary names the top risk when there is one", () => {
    const k = {
      revenue: 100, prevRevenue: 0, revenueDeltaPct: null, occupancy: 10, prevOccupancy: 0, adr: 50, prevAdr: 0, revpar: 5, prevRevpar: 0,
      bookings: 2, prevBookings: 0, cancellationRate: 0, debt: 0, expenses: 0, netProfit: 100, roomNights: 2, capacity: 20, rangeDays: 10,
    };
    const s = deterministicSummary(k, [{ id: "occupancy-low", kind: "risk", severity: "critical", title: "Низкая загрузка — 10%", detail: "" }]);
    expect(s).toContain("Главный риск: низкая загрузка — 10%");
    expect(s).toContain("без базы для сравнения");
  });
});

describe("sourceShares", () => {
  it("splits holding revenue by source with rounded shares", () => {
    const from = d("2026-09-01");
    const to = d("2026-09-30");
    const s = sourceShares(
      [booking({ date: "2026-09-02", price: 300, sourceName: "A" }), booking({ date: "2026-09-03", price: 100, sourceName: "B" }), booking({ date: "2026-09-03", price: 999, sourceName: "B", status: "NO_SHOW" })],
      from,
      to
    );
    expect(s).toEqual([
      { name: "A", total: 300, count: 1, share: 75 },
      { name: "B", total: 100, count: 1, share: 25 },
    ]);
  });
});
