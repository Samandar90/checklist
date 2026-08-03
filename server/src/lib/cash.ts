/**
 * Pure cash-drawer maths for shift reconciliation — extracted so the money
 * rules can be unit-tested without a database. Imported by routes/cashShifts.ts;
 * unit-tested in lib/cash.test.ts.
 */
import { ROOM_HOLDING_STATUSES } from "../statuses";

export interface CashBooking {
  status: string;
  paymentStatus: string;
  price: number;
  paidAmount?: number | null;
}

/**
 * Cash actually taken over the counter for these bookings.
 *
 * Callers must already have narrowed to `paymentMethod: "Наличные"` — payment
 * method is not re-checked here. Two rules decide the rest, and they are the
 * same ones revenue and debt use everywhere else in the project:
 *   • a cancellation or a no-show holds no money (see ../statuses) — such a
 *     booking never reaches the drawer, so it must not raise the expected total;
 *   • "Долг" contributes nothing, "Частично" contributes only what was paid.
 */
export function cashInFromBookings(bookings: CashBooking[]): number {
  return bookings.reduce((sum, b) => {
    if (!ROOM_HOLDING_STATUSES.includes(b.status)) return sum;
    if (b.paymentStatus === "Долг") return sum;
    if (b.paymentStatus === "Частично") return sum + (b.paidAmount ?? 0);
    return sum + b.price;
  }, 0);
}
