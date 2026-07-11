/**
 * Booking statuses that hold the room's nights AND count toward revenue/debt.
 * A cancellation or a no-show frees the room and holds no money — every
 * revenue, occupancy and debt figure must ignore those bookings.
 * Mirrored on the client in src/lib/bookingStatus.ts (ROOM_HOLDING_STATUSES).
 */
export const ROOM_HOLDING_STATUSES = ["RESERVED", "CHECKED_IN", "CHECKED_OUT"];
