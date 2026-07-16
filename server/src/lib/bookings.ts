/**
 * Pure booking maths — extracted so the money- and date-critical invariants
 * (nights, overlap, debt) can be unit-tested without a database or Express.
 * Imported by routes/reports.ts; unit-tested in lib/bookings.test.ts.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Floor a date to the start of its local day so nights are counted in whole days. */
export function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Half-open night range [start, end) for a booking; a missing checkout = one night. */
export function nightRange(date: Date, checkOut: Date | null): { start: Date; end: Date } {
  const start = dayStart(date);
  const out = checkOut ? dayStart(checkOut) : null;
  const end = out && out.getTime() > start.getTime() ? out : new Date(start.getTime() + DAY_MS);
  return { start, end };
}

/** Number of nights in a booking (missing/invalid checkout = 1). */
export function nightsBetween(date: Date, checkOut: Date | null): number {
  const { start, end } = nightRange(date, checkOut);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

/**
 * Do two half-open ranges [aStart, aEnd) and [bStart, bEnd) overlap?
 * This is the double-booking invariant: same-room stays may share an edge
 * (checkout day == next check-in day) but never an interior night.
 */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Do two bookings collide on their nights? */
export function bookingsOverlap(
  a: { date: Date; checkOut: Date | null },
  b: { date: Date; checkOut: Date | null }
): boolean {
  const ra = nightRange(a.date, a.checkOut);
  const rb = nightRange(b.date, b.checkOut);
  return rangesOverlap(ra.start.getTime(), ra.end.getTime(), rb.start.getTime(), rb.end.getTime());
}

/**
 * Normalize the stored paid amount so debt is always `price - (paidAmount ?? price)`:
 * "Оплачено" → null (fully paid), "Долг" → 0, "Частично" → the entered amount.
 */
export function normalizePaid(data: { paymentStatus: string; paidAmount?: number | null; price: number }): number | null {
  if (data.paymentStatus === "Оплачено") return null;
  if (data.paymentStatus === "Долг") return 0;
  return data.paidAmount ?? 0;
}

/** Outstanding debt: paidAmount === null/undefined means fully paid. */
export function outstandingDebt(price: number, paidAmount?: number | null): number {
  return price - (paidAmount ?? price);
}
