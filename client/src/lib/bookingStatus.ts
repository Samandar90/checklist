import { CalendarClock, LogIn, LogOut, Ban, UserX } from "lucide-react";
import { BookingStatus } from "@/types";

export const STATUS_META: Record<BookingStatus, { label: string; icon: typeof LogIn; tint: string }> = {
  RESERVED: { label: "Забронировано", icon: CalendarClock, tint: "tint-sky" },
  CHECKED_IN: { label: "Заселён", icon: LogIn, tint: "tint-emerald" },
  CHECKED_OUT: { label: "Выехал", icon: LogOut, tint: "tint-slate" },
  CANCELLED: { label: "Отменено", icon: Ban, tint: "tint-rose" },
  NO_SHOW: { label: "Не заехал", icon: UserX, tint: "tint-amber" },
};

/**
 * Statuses that actually hold the room's nights — mirrors the server's
 * ROOM_HOLDING_STATUSES: a cancellation or a no-show frees the room.
 */
export const ROOM_HOLDING_STATUSES: BookingStatus[] = ["RESERVED", "CHECKED_IN", "CHECKED_OUT"];
export const holdsRoom = (s: BookingStatus) => ROOM_HOLDING_STATUSES.includes(s);

export const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = (
  Object.keys(STATUS_META) as BookingStatus[]
).map((value) => ({ value, label: STATUS_META[value].label }));

/**
 * Solid fill classes for the calendar chessboard bars — the single source of truth
 * for reservation-status color so it's never re-guessed per component.
 * RESERVED = blue, CHECKED_IN = green, CHECKED_OUT = gray (the three states staff
 * scan for); CANCELLED / NO_SHOW keep the same hue family as their STATUS_META tint
 * so they read as distinct terminal states rather than being mistaken for CHECKED_OUT.
 */
export const STATUS_BAR_CLASS: Record<BookingStatus, string> = {
  RESERVED: "bg-blue-500 hover:bg-blue-600 text-white",
  CHECKED_IN: "bg-green-500 hover:bg-green-600 text-white",
  CHECKED_OUT: "bg-gray-400 hover:bg-gray-500 text-white",
  CANCELLED: "bg-rose-500 hover:bg-rose-600 text-white",
  NO_SHOW: "bg-amber-500 hover:bg-amber-600 text-white",
};

/** Plain solid-dot classes matching STATUS_BAR_CLASS, for small legend/filter swatches. */
export const STATUS_DOT_CLASS: Record<BookingStatus, string> = {
  RESERVED: "bg-blue-500",
  CHECKED_IN: "bg-green-500",
  CHECKED_OUT: "bg-gray-400",
  CANCELLED: "bg-rose-500",
  NO_SHOW: "bg-amber-500",
};
