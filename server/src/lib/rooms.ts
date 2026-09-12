/** Room-number rules. Kept pure so the branch invariant is unit-testable. */

export interface RoomLike {
  id: string;
  roomNumber: string;
}

/** Room numbers are compared trimmed and case-insensitively: "101 " and "101"
 * are the same door, and so are "Lux-1" and "lux-1". SQLite has no
 * case-insensitive `mode` in Prisma, so the comparison happens here. */
export function sameRoomNumber(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * The room in `siblings` that already occupies `roomNumber`, if any.
 *
 * `ignoreId` is the room being edited — it must not collide with itself.
 * Callers pass only rooms of one branch: the same number in two branches is
 * normal (every hotel has a 101), two in one branch is not.
 */
export function findRoomNumberClash<T extends RoomLike>(
  siblings: T[],
  roomNumber: string,
  ignoreId?: string
): T | undefined {
  return siblings.find((r) => r.id !== ignoreId && sameRoomNumber(r.roomNumber, roomNumber));
}
