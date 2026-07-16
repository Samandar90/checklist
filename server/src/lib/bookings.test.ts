import { describe, it, expect } from "vitest";
import {
  nightRange,
  nightsBetween,
  rangesOverlap,
  bookingsOverlap,
  normalizePaid,
  outstandingDebt,
} from "./bookings";

const d = (iso: string) => new Date(iso);

describe("nightRange", () => {
  it("spans check-in day to check-out day (half-open)", () => {
    const { start, end } = nightRange(d("2026-07-06"), d("2026-07-09"));
    expect(start.getDate()).toBe(6);
    expect(end.getDate()).toBe(9);
  });

  it("treats a missing checkout as a single night", () => {
    const { start, end } = nightRange(d("2026-07-06"), null);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("falls back to one night when checkout is not after check-in", () => {
    const { start, end } = nightRange(d("2026-07-06"), d("2026-07-06"));
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("ignores the time-of-day, counting whole nights", () => {
    expect(nightsBetween(d("2026-07-06T23:30:00"), d("2026-07-09T01:00:00"))).toBe(3);
  });
});

describe("nightsBetween", () => {
  it("counts nights, not calendar days", () => {
    expect(nightsBetween(d("2026-07-06"), d("2026-07-07"))).toBe(1);
    expect(nightsBetween(d("2026-07-06"), d("2026-07-09"))).toBe(3);
  });
  it("is 1 night when no checkout", () => {
    expect(nightsBetween(d("2026-07-06"), null)).toBe(1);
  });
});

describe("rangesOverlap (double-booking invariant)", () => {
  it("overlapping interiors collide", () => {
    expect(rangesOverlap(0, 3, 1, 4)).toBe(true);
    expect(rangesOverlap(1, 4, 0, 3)).toBe(true);
  });
  it("touching edges do NOT collide (checkout day == next check-in)", () => {
    expect(rangesOverlap(0, 3, 3, 5)).toBe(false);
    expect(rangesOverlap(3, 5, 0, 3)).toBe(false);
  });
  it("fully separate ranges do not collide", () => {
    expect(rangesOverlap(0, 2, 5, 7)).toBe(false);
  });
  it("containment collides", () => {
    expect(rangesOverlap(0, 10, 3, 4)).toBe(true);
  });
});

describe("bookingsOverlap", () => {
  it("checkout-day and same-day check-in tessellate without colliding", () => {
    const a = { date: d("2026-07-06"), checkOut: d("2026-07-09") };
    const b = { date: d("2026-07-09"), checkOut: d("2026-07-11") };
    expect(bookingsOverlap(a, b)).toBe(false);
  });
  it("an overlapping stay in the same room collides", () => {
    const a = { date: d("2026-07-06"), checkOut: d("2026-07-09") };
    const b = { date: d("2026-07-08"), checkOut: d("2026-07-10") };
    expect(bookingsOverlap(a, b)).toBe(true);
  });
  it("two single-night stays on the same night collide", () => {
    const a = { date: d("2026-07-06"), checkOut: null };
    const b = { date: d("2026-07-06"), checkOut: null };
    expect(bookingsOverlap(a, b)).toBe(true);
  });
});

describe("normalizePaid", () => {
  it("fully paid stores null (means price)", () => {
    expect(normalizePaid({ paymentStatus: "Оплачено", price: 1000 })).toBeNull();
  });
  it("debt stores 0 paid", () => {
    expect(normalizePaid({ paymentStatus: "Долг", price: 1000 })).toBe(0);
  });
  it("partial stores the entered amount", () => {
    expect(normalizePaid({ paymentStatus: "Частично", paidAmount: 400, price: 1000 })).toBe(400);
  });
  it("partial with no amount defaults to 0", () => {
    expect(normalizePaid({ paymentStatus: "Частично", price: 1000 })).toBe(0);
  });
});

describe("outstandingDebt", () => {
  it("null paid means fully paid → no debt", () => {
    expect(outstandingDebt(1000, null)).toBe(0);
    expect(outstandingDebt(1000, undefined)).toBe(0);
  });
  it("zero paid means the whole price is owed", () => {
    expect(outstandingDebt(1000, 0)).toBe(1000);
  });
  it("partial paid owes the remainder", () => {
    expect(outstandingDebt(1000, 400)).toBe(600);
  });
});
