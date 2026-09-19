/**
 * The single place a room's availability is checked.
 *
 * A night is closed either by an active booking (RESERVED / CHECKED_IN /
 * CHECKED_OUT — see ./statuses) or by a room block (temporary hold, blocked
 * dates, out of order — see ./lib/roomBlocks). Every writer that puts a stay
 * or a block on a room — create, edit, revive a cancellation, bulk move — must
 * pass through findRoomConflict, so the two kinds of occupancy can never
 * overlap each other. Enforced in the app layer because SQLite has no
 * exclusion constraints.
 */

import { prisma } from "./prisma";
import { ROOM_HOLDING_STATUSES } from "./statuses";
import { DAY_MS, nightRange } from "./lib/bookings";
import { activeBlockWhere, blockRange, describeBlock } from "./lib/roomBlocks";

export interface RoomConflict {
  type: "booking" | "block";
  roomNumber: string;
  start: Date;
  /** Booking: checkOut as stored (null = one night). Block: its endDate. */
  end: Date | null;
  /** Guest name, or what the block is ("временное хранение, Иванов"). */
  who: string;
}

export interface ConflictExclusions {
  /** The booking being edited / moved — it may keep its own nights. */
  bookingId?: string | null;
  /** The block being edited, or the hold a booking is being made out of. */
  blockId?: string | null;
}

/**
 * Find whatever already closes a night of [start, end) on this room, or null.
 * Bookings are reported before blocks only because a guest is the more useful
 * thing to name in the error message.
 */
export async function findRoomConflict(
  roomId: string,
  start: Date,
  end: Date,
  exclude: ConflictExclusions = {},
  now: Date = new Date()
): Promise<RoomConflict | null> {
  const [bookings, blocks] = await Promise.all([
    prisma.monthlyReport.findMany({
      where: {
        roomId,
        status: { in: ROOM_HOLDING_STATUSES },
        date: { lt: end }, // existing.start < new.end (cheap pre-filter; exact end check below)
        ...(exclude.bookingId ? { id: { not: exclude.bookingId } } : {}),
      },
      include: { room: true },
      orderBy: { date: "asc" },
    }),
    // Pre-filter widened by a day either side: timestamps are compared as
    // stored, the exact whole-night check follows in JS.
    prisma.roomBlock.findMany({
      where: {
        roomId,
        startDate: { lt: new Date(end.getTime() + DAY_MS) },
        endDate: { gt: new Date(start.getTime() - DAY_MS) },
        ...activeBlockWhere(now),
        ...(exclude.blockId ? { id: { not: exclude.blockId } } : {}),
      },
      include: { room: true },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const booking = bookings.find((r) => {
    const range = nightRange(new Date(r.date), r.checkOut ? new Date(r.checkOut) : null);
    return range.end.getTime() > start.getTime(); // existing.end > new.start
  });
  if (booking) {
    return {
      type: "booking",
      roomNumber: booking.room.roomNumber,
      start: new Date(booking.date),
      end: booking.checkOut ? new Date(booking.checkOut) : null,
      who: booking.guestName ?? "",
    };
  }

  const block = blocks.find((b) => {
    const range = blockRange(b);
    return range.start.getTime() < end.getTime() && range.end.getTime() > start.getTime();
  });
  if (block) {
    return {
      type: "block",
      roomNumber: block.room.roomNumber,
      start: new Date(block.startDate),
      end: new Date(block.endDate),
      who: describeBlock(block),
    };
  }
  return null;
}

export const dmy = (d: Date) => d.toLocaleDateString("ru-RU");

/** Text for the 409: "Номер 12 уже занят / закрыт на эти даты (…). <tail>" */
export function busyMessage(c: RoomConflict, tail: string): string {
  const period = `${dmy(c.start)}${c.end ? `–${dmy(c.end)}` : ""}`;
  const who = c.who ? `, ${c.who}` : "";
  return c.type === "booking"
    ? `Номер ${c.roomNumber} уже занят на эти даты (${period}${who}). ${tail}`
    : `Номер ${c.roomNumber} закрыт на эти даты (${period}${who}). ${tail}`;
}
