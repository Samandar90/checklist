/**
 * Pure helpers for room blocks — the non-booking reasons a room is closed for
 * sale: a temporary hold (HOLD), blocked dates (BLOCK) or an out-of-order room
 * (OUT_OF_ORDER). Kept free of Prisma/Express so the expiry and range rules can
 * be unit-tested (lib/roomBlocks.test.ts). Mirrored on the client in
 * src/lib/roomBlocks.ts.
 */

import { nightRange } from "./bookings";

export const ROOM_BLOCK_KINDS = ["HOLD", "BLOCK", "OUT_OF_ORDER"] as const;
export type RoomBlockKind = (typeof ROOM_BLOCK_KINDS)[number];

export const ROOM_BLOCK_LABELS: Record<RoomBlockKind, string> = {
  HOLD: "временное хранение",
  BLOCK: "даты заблокированы",
  OUT_OF_ORDER: "номер не работает",
};

/** Same guard as isBookingStatus: "constructor" must not pass as a kind. */
export function isRoomBlockKind(kind: unknown): kind is RoomBlockKind {
  return typeof kind === "string" && (ROOM_BLOCK_KINDS as readonly string[]).includes(kind);
}

export interface BlockLike {
  kind: string;
  holdUntil: Date | null;
}

/**
 * A hold stops closing the room the moment holdUntil passes — the guest never
 * confirmed, so the nights go back on sale by themselves. Blocked dates and an
 * out-of-order room never expire on their own; staff lift them explicitly.
 */
export function blockIsActive(block: BlockLike, now: Date): boolean {
  if (block.kind !== "HOLD" || !block.holdUntil) return true;
  return block.holdUntil.getTime() > now.getTime();
}

/** Prisma `where` fragment selecting the blocks that still close the room at `now`. */
export function activeBlockWhere(now: Date) {
  return { OR: [{ kind: { not: "HOLD" } }, { holdUntil: null }, { holdUntil: { gt: now } }] };
}

/** Half-open night range [startDate, endDate) a block closes — the booking rule. */
export function blockRange(block: { startDate: Date; endDate: Date }): { start: Date; end: Date } {
  return nightRange(block.startDate, block.endDate);
}

/** "временное хранение, Иванов" — for 409 messages and the audit log. */
export function describeBlock(block: { kind: string; guestName?: string | null }): string {
  const label = isRoomBlockKind(block.kind) ? ROOM_BLOCK_LABELS[block.kind] : block.kind;
  return block.guestName ? `${label}, ${block.guestName}` : label;
}
