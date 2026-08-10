import { describe, it, expect } from "vitest";
import {
  nightRange,
  nightsBetween,
  rangesOverlap,
  bookingsOverlap,
  nightsWithinWindow,
  normalizePaid,
  outstandingDebt,
  stayOverlapsWindow,
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

describe("nightsWithinWindow (dashboard occupancy)", () => {
  // Window = the whole of July 2026, half-open [1 July, 1 Aug).
  const wStart = d("2026-07-01");
  const wEnd = d("2026-08-01");

  it("counts every night of a stay fully inside the window", () => {
    expect(nightsWithinWindow(d("2026-07-06"), d("2026-07-09"), wStart, wEnd)).toBe(3);
  });

  it("counts only the in-window nights of a stay that started earlier", () => {
    // 25 June → 10 July: nine nights fall in July.
    expect(nightsWithinWindow(d("2026-06-25"), d("2026-07-10"), wStart, wEnd)).toBe(9);
  });

  it("clamps a stay that runs past the end of the window", () => {
    // 28 July → 5 Aug: four nights fall in July.
    expect(nightsWithinWindow(d("2026-07-28"), d("2026-08-05"), wStart, wEnd)).toBe(4);
  });

  it("clamps a stay that straddles the whole window", () => {
    expect(nightsWithinWindow(d("2026-06-01"), d("2026-09-01"), wStart, wEnd)).toBe(31);
  });

  it("is 0 for stays entirely outside the window", () => {
    expect(nightsWithinWindow(d("2026-05-01"), d("2026-05-05"), wStart, wEnd)).toBe(0);
    expect(nightsWithinWindow(d("2026-09-01"), d("2026-09-05"), wStart, wEnd)).toBe(0);
  });

  it("is 0 when the checkout day equals the window start (edge, no shared night)", () => {
    expect(nightsWithinWindow(d("2026-06-25"), d("2026-07-01"), wStart, wEnd)).toBe(0);
  });

  it("counts a checkout-less stay as its single night", () => {
    expect(nightsWithinWindow(d("2026-07-15"), null, wStart, wEnd)).toBe(1);
    expect(nightsWithinWindow(d("2026-06-30"), null, wStart, wEnd)).toBe(0);
  });
});

describe("stayOverlapsWindow", () => {
  // The calendar asks for one week: 10–16 July (half-open, so 17 July excluded).
  const from = d("2026-07-10");
  const toExclusive = d("2026-07-17");

  it("includes a stay contained in the window", () => {
    expect(stayOverlapsWindow(d("2026-07-12"), d("2026-07-14"), from, toExclusive)).toBe(true);
  });

  it("includes a long stay that began long before the window", () => {
    // Regression: the calendar used to look back only 31 days, so this
    // three-month guest vanished from the grid and the room read as free.
    expect(stayOverlapsWindow(d("2026-04-01"), d("2026-09-01"), from, toExclusive)).toBe(true);
    expect(stayOverlapsWindow(d("2026-05-20"), d("2026-07-11"), from, toExclusive)).toBe(true);
  });

  it("excludes stays that end exactly when the window opens", () => {
    // Half-open: a checkout on the 10th shares no night with the 10th onwards.
    expect(stayOverlapsWindow(d("2026-06-01"), d("2026-07-10"), from, toExclusive)).toBe(false);
  });

  it("excludes stays that start exactly when the window closes", () => {
    expect(stayOverlapsWindow(d("2026-07-17"), d("2026-07-20"), from, toExclusive)).toBe(false);
  });

  it("treats a missing checkout as one night", () => {
    expect(stayOverlapsWindow(d("2026-07-16"), null, from, toExclusive)).toBe(true);
    expect(stayOverlapsWindow(d("2026-07-09"), null, from, toExclusive)).toBe(false);
    // The night of the 9th runs into the 10th only if check-in is after 00:00.
    expect(stayOverlapsWindow(d("2026-07-09T18:00:00"), null, from, toExclusive)).toBe(true);
  });

  it("is false for stays entirely outside the window", () => {
    expect(stayOverlapsWindow(d("2026-05-01"), d("2026-05-05"), from, toExclusive)).toBe(false);
    expect(stayOverlapsWindow(d("2026-09-01"), d("2026-09-05"), from, toExclusive)).toBe(false);
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
