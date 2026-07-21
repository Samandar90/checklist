import { describe, it, expect } from "vitest";
import { nightsBetween, reportDebt, pluralRu, addDaysIso, isoDay, todayIso, currentMonthKey } from "./utils";

describe("nightsBetween", () => {
  it("counts nights between two ISO dates", () => {
    expect(nightsBetween("2026-07-06", "2026-07-07")).toBe(1);
    expect(nightsBetween("2026-07-06", "2026-07-09")).toBe(3);
  });
  it("returns 1 when there is no checkout", () => {
    expect(nightsBetween("2026-07-06", null)).toBe(1);
    expect(nightsBetween("2026-07-06", undefined)).toBe(1);
  });
  it("never goes below 1 night for a non-positive range", () => {
    expect(nightsBetween("2026-07-06", "2026-07-06")).toBe(1);
    expect(nightsBetween("2026-07-09", "2026-07-06")).toBe(1);
  });
});

describe("reportDebt", () => {
  it("null/undefined paidAmount means fully paid → no debt", () => {
    expect(reportDebt({ price: 1000, paidAmount: null })).toBe(0);
    expect(reportDebt({ price: 1000 })).toBe(0);
  });
  it("zero paid owes the whole price", () => {
    expect(reportDebt({ price: 1000, paidAmount: 0 })).toBe(1000);
  });
  it("partial paid owes the remainder", () => {
    expect(reportDebt({ price: 1000, paidAmount: 400 })).toBe(600);
  });
});

describe("pluralRu", () => {
  const nights = (n: number) => pluralRu(n, "ночь", "ночи", "ночей");
  it("uses the 'one' form for 1, 21, 31", () => {
    expect(nights(1)).toBe("ночь");
    expect(nights(21)).toBe("ночь");
  });
  it("uses the 'few' form for 2–4, 22–24", () => {
    expect(nights(2)).toBe("ночи");
    expect(nights(3)).toBe("ночи");
    expect(nights(23)).toBe("ночи");
  });
  it("uses the 'many' form for 5–20, 11–14", () => {
    expect(nights(5)).toBe("ночей");
    expect(nights(11)).toBe("ночей");
    expect(nights(12)).toBe("ночей");
    expect(nights(14)).toBe("ночей");
    expect(nights(0)).toBe("ночей");
  });
});

describe("isoDay / todayIso (local calendar, not UTC)", () => {
  it("uses the local date parts", () => {
    // 2026-07-06 00:30 local — in any timezone east of UTC this is still the 6th
    // locally, while toISOString() would report the 5th.
    const d = new Date(2026, 6, 6, 0, 30, 0);
    expect(isoDay(d)).toBe("2026-07-06");
  });

  it("keeps the local day just before midnight", () => {
    const d = new Date(2026, 6, 6, 23, 59, 0);
    expect(isoDay(d)).toBe("2026-07-06");
  });

  it("todayIso matches the local calendar day", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    expect(todayIso()).toBe(expected);
  });

  it("currentMonthKey is the local YYYY-MM", () => {
    expect(currentMonthKey()).toBe(todayIso().slice(0, 7));
  });
});

describe("addDaysIso", () => {
  it("adds days and keeps YYYY-MM-DD", () => {
    expect(addDaysIso("2026-07-06", 1)).toBe("2026-07-07");
    expect(addDaysIso("2026-07-31", 1)).toBe("2026-08-01");
  });
  it("subtracts with a negative delta", () => {
    expect(addDaysIso("2026-08-01", -1)).toBe("2026-07-31");
  });
});
